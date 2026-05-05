/**
 * Performance Reviewer Agent for SEA
 * Reviews diff content of changed files for performance issues
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceState } from '../state/workspaceState.js';
import { PerformanceReviewReport } from '../state/schemas.js';
import { getRunPaths } from '../workflow/checkpoint.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PerformanceReviewerAgent');

/**
 * Create the performance reviewer agent function
 */
export function createPerformanceReviewerAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running performance reviewer agent');

    const { componentStates } = state;
    const runPaths = getRunPaths(state.runId);

    const report: PerformanceReviewReport = {
      status: 'approved',
      findings: [],
      blockers: 0,
      warnings: [],
      notes: [],
    };

    let totalAddedLines = 0;

    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      if (componentState.changeRole !== 'modify') continue;
      if (componentState.changedFiles.length === 0) continue;

      // Read the diff content for this component
      let diffContent = '';
      if (componentState.diffPath) {
        const diffFilePath = path.join(runPaths.componentsDir, componentState.diffPath);
        try {
          diffContent = await fs.readFile(diffFilePath, 'utf-8');
        } catch {
          logger.warn(`Could not read diff file for ${componentName}: ${componentState.diffPath}`);
        }
      }

      // Count added lines
      const addedLines = diffContent
        .split('\n')
        .filter(line => line.startsWith('+') && !line.startsWith('+++'));
      totalAddedLines += addedLines.length;

      // Analyze diff content for performance patterns
      const componentFindings = analyzePerformanceInDiff(addedLines, componentState.changedFiles, componentName);

      report.findings.push(...componentFindings);
      report.blockers += componentFindings.filter(f => f.severity === 'critical').length;

      // Check for large file count
      if (componentState.changedFiles.length > 20) {
        report.warnings.push(
          `Large change to ${componentName}: ${componentState.changedFiles.length} files modified`
        );
      }

      // Check for performance-critical files
      const perfCriticalBasenames = [
        'index.js', 'index.ts', 'main.js', 'main.ts',
        'App.js', 'App.tsx', 'app.js', 'app.tsx',
        'server.js', 'server.ts',
        'api.ts', 'handler.ts', 'middleware.ts',
        'router.ts', 'router.js',
      ];
      for (const file of componentState.changedFiles) {
        const fileName = file.split('/').pop() || '';
        if (perfCriticalBasenames.includes(fileName)) {
          report.findings.push({
            severity: 'medium',
            category: 'hot-path',
            description: `Performance-critical file modified: ${file}`,
            recommendation: 'Ensure no performance regressions in hot paths',
          });
        }
      }
    }

    // Warn on large overall diffs
    if (totalAddedLines > 500) {
      report.warnings.push(`Large diff: ${totalAddedLines} total added lines across all components`);
    }

    // Determine status
    if (report.blockers > 0) {
      report.status = 'blocked';
    } else if (report.warnings.length > 0 || report.findings.some(f => f.severity === 'high' || f.severity === 'medium')) {
      report.status = 'approved_with_notes';
    }

    logger.info(`Performance review: ${report.status}, ${report.findings.length} findings`);

    return { performanceReview: report };
  };
}

/**
 * Patterns that may indicate performance issues in added code lines
 */
const PERFORMANCE_PATTERNS = [
  {
    pattern: /JSON\.parse\s*\(\s*JSON\.stringify/,
    severity: 'medium' as const,
    category: 'deep-clone',
    description: 'Deep clone via JSON.parse(JSON.stringify())',
    recommendation: 'Use structuredClone() or a dedicated deep clone library',
  },
  {
    pattern: /\.forEach\s*\([^)]*\)\s*[^;]*\bawait\b/,
    severity: 'high' as const,
    category: 'sequential-async',
    description: 'Sequential async operations in forEach loop',
    recommendation: 'Use Promise.all() or for...of loop for concurrent async operations',
  },
  {
    pattern: /for\s*\([^)]*\)\s*\{[^}]*await\s/,
    severity: 'medium' as const,
    category: 'sequential-async',
    description: 'Sequential awaits inside for loop',
    recommendation: 'Consider using Promise.all() for independent async operations',
  },
  {
    pattern: /console\.(log|debug|info|warn|error)\s*\(/,
    severity: 'low' as const,
    category: 'logging',
    description: 'Console logging in production code',
    recommendation: 'Use a proper logging library with configurable log levels',
  },
  {
    pattern: /document\.querySelectorAll|document\.getElementsByTagName/,
    severity: 'low' as const,
    category: 'dom-access',
    description: 'DOM query in application code',
    recommendation: 'Minimize direct DOM queries; prefer data-driven rendering',
  },
  {
    pattern: /new\s+RegExp\s*\(/,
    severity: 'low' as const,
    category: 'regex',
    description: 'RegExp constructed at runtime',
    recommendation: 'Pre-compile regex patterns outside hot loops',
  },
  {
    pattern: /\.subscribe\s*\(\s*(?![^)]*\btakeUntil\b)/,
    severity: 'medium' as const,
    category: 'memory-leak',
    description: 'Observable subscription without takeUntil/unsubscribe guard',
    recommendation: 'Ensure subscriptions are cleaned up on component destroy',
  },
];

interface PerformanceFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  recommendation: string;
}

function analyzePerformanceInDiff(
  addedLines: string[],
  changedFiles: string[],
  componentName: string
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  if (addedLines.length === 0) return findings;

  // Scan each added line against performance patterns
  for (const line of addedLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
      continue; // Skip comments and imports
    }

    for (const { pattern, severity, category, description, recommendation } of PERFORMANCE_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          severity,
          category,
          description: `${description}: ${trimmed.substring(0, 100)}`,
          location: componentName,
          recommendation,
        });
      }
    }
  }

  logger.debug(`Analyzed ${addedLines.length} added lines in ${componentName}, found ${findings.length} performance findings`);

  return findings;
}

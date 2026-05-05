/**
 * Security Reviewer Agent for SEA
 * Reviews diff content of changed files for security issues
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceState } from '../state/workspaceState.js';
import { SecurityReviewReport, SecurityStatus } from '../state/schemas.js';
import { getRunPaths } from '../workflow/checkpoint.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SecurityReviewerAgent');

/**
 * Create the security reviewer agent function
 */
export function createSecurityReviewerAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running security reviewer agent');

    const { componentStates } = state;
    const runPaths = getRunPaths(state.runId, state.baseDir);

    const findings: SecurityReviewReport['findings'] = [];
    let blockers = 0;
    const warnings: string[] = [];
    const notes: string[] = [];

    // Collect all changed files from all components
    const allChangedFiles: string[] = [];

    // Analyze each modified component
    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      if (componentState.changeRole !== 'modify') continue;
      if (componentState.changedFiles.length === 0) continue;

      allChangedFiles.push(...componentState.changedFiles);

      // Read the diff content for this component
      let diffContent = '';
      if (componentState.diffPath) {
        const diffFilePath = path.join(runPaths.runDir, componentState.diffPath);
        try {
          diffContent = await fs.readFile(diffFilePath, 'utf-8');
        } catch {
          logger.warn(`Could not read diff file for ${componentName}: ${componentState.diffPath}`);
        }
      }

      const componentFindings = analyzeSecurityIssues(
        diffContent,
        componentState.changedFiles,
        componentName
      );

      findings.push(...componentFindings);
      blockers += componentFindings.filter(f => f.severity === 'critical').length;
    }

    // Check for authentication/authorization changes
    const hasAuthChanges = checkForAuthChanges(allChangedFiles);
    if (hasAuthChanges) {
      findings.push({
        severity: 'high',
        category: 'authentication',
        description: 'Authentication/authorization code changed',
        recommendation: 'Ensure proper access controls are maintained',
      });
      blockers += 1;
    }

    // Check for sensitive data handling
    const hasSensitiveData = checkForSensitiveData(allChangedFiles);
    if (hasSensitiveData) {
      findings.push({
        severity: 'medium',
        category: 'data-protection',
        description: 'Sensitive data handling detected',
        recommendation: 'Verify proper encryption and data protection',
      });
    }

    // Determine status
    let status: SecurityStatus;
    if (blockers > 0) {
      status = 'blocked';
    } else if (findings.some(f => f.severity === 'high')) {
      status = 'approved_with_notes';
      notes.push('High-severity findings found but not blocking');
    } else if (warnings.length > 0) {
      status = 'approved_with_notes';
    } else {
      status = 'approved';
    }

    const report: SecurityReviewReport = {
      status,
      findings,
      blockers,
      warnings,
      notes,
    };

    return { securityReview: report };
  };
}

interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  recommendation: string;
}

/**
 * Dangerous code patterns to scan for in diff content.
 * Each pattern is matched against added lines (lines starting with +).
 */
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, severity: 'high' as const, category: 'code-injection', recommendation: 'Avoid using eval() - use safer alternatives' },
  { pattern: /innerHTML\s*=/, severity: 'medium' as const, category: 'xss', recommendation: 'Use textContent or sanitize HTML before assignment' },
  { pattern: /document\.write/, severity: 'medium' as const, category: 'xss', recommendation: 'Use DOM APIs instead of document.write' },
  { pattern: /password\s*=\s*["'][^"']+["']/, severity: 'high' as const, category: 'credentials', recommendation: 'Use environment variables for secrets, never hardcode passwords' },
  { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/i, severity: 'high' as const, category: 'secrets', recommendation: 'Use environment variables for API keys' },
  { pattern: /crypto\.(createCipher|createDecipher)\(/, severity: 'medium' as const, category: 'crypto', recommendation: 'Use crypto.createCipheriv/createDecipheriv instead (requires explicit IV)' },
  { pattern: /new\s+Function\s*\(/, severity: 'high' as const, category: 'code-injection', recommendation: 'Avoid creating functions from strings - use arrow functions or function declarations' },
  { pattern: /\.exec\s*\(/, severity: 'medium' as const, category: 'command-injection', recommendation: 'Ensure command arguments are properly sanitized' },
  { pattern: /child_process/, severity: 'medium' as const, category: 'command-injection', recommendation: 'Review child_process usage for injection risks' },
  { pattern: /SQL\s*\+\s*["']|execute\s*\(\s*["']/i, severity: 'critical' as const, category: 'sql-injection', recommendation: 'Use parameterized queries to prevent SQL injection' },
  { pattern: /setTimeout\s*\(\s*["']|setInterval\s*\(\s*["']/, severity: 'low' as const, category: 'code-injection', recommendation: 'Avoid passing strings to setTimeout/setInterval - use function references' },
  { pattern: /\bSELECT\b.*\+\b.*\bFROM\b/i, severity: 'critical' as const, category: 'sql-injection', recommendation: 'String concatenation in SQL queries detected - use parameterized queries' },
];

function analyzeSecurityIssues(
  diffContent: string,
  changedFiles: string[],
  componentName: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  if (!diffContent) {
    logger.debug(`No diff content for ${componentName} - skipping pattern analysis`);
    return findings;
  }

  // Extract added lines from unified diff (lines starting with +, but not +++ header)
  const addedLines = diffContent
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1)); // Remove leading +

  // Scan each added line against dangerous patterns
  for (const line of addedLines) {
    for (const { pattern, severity, category, recommendation } of DANGEROUS_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          severity,
          category,
          description: `Dangerous pattern in added code: ${line.trim().substring(0, 120)}`,
          location: componentName,
          recommendation,
        });
      }
    }
  }

  logger.debug(`Analyzed ${addedLines.length} added lines in ${componentName}, found ${findings.length} security findings`);

  return findings;
}

function checkForAuthChanges(changedFiles: string[]): boolean {
  const authKeywords = ['auth', 'login', 'password', 'session', 'token', 'permission', 'access'];
  return changedFiles.some(file =>
    authKeywords.some(k => file.toLowerCase().includes(k))
  );
}

function checkForSensitiveData(changedFiles: string[]): boolean {
  const sensitiveKeywords = ['secret', 'credential', 'password', 'token', 'key', 'private'];
  return changedFiles.some(file =>
    sensitiveKeywords.some(k => file.toLowerCase().includes(k))
  );
}

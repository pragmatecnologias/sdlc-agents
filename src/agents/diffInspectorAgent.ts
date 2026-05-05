/**
 * Diff Inspector Agent for SEA
 * Inspects git diff and validates against allowed/protected/forbidden paths
 */

import * as path from 'path';
import {
  WorkspaceState,
  ComponentState,
} from '../state/workspaceState.js';
import { getGitDiff, getGitStatus, GitStatus } from '../tools/gitTool.js';
import { getRunPaths, saveComponentArtifact } from '../workflow/checkpoint.js';
import { resolveComponentPathFromState } from '../tools/resolvePath.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DiffInspectorAgent');

export interface DiffInspectionResult {
  changedFiles: string[];
  forbiddenPathViolations: string[];
  protectedPathViolations: string[];
  diffClean: boolean;
  warnings: string[];
}

/**
 * Create the diff inspector agent function
 */
export function createDiffInspectorAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running diff inspector agent');

    const { workspace, componentStates } = state;

    const updatedComponentStates = { ...(componentStates || {}) };
    const allViolations: string[] = [];

    // Inspect each component that was modified
    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      if (componentState.changeRole !== 'modify') {
        continue;
      }

      const component = workspace.components?.find(c => c.name === componentName);
      if (!component) continue;

      // Resolve component path using centralized resolver
      const resolvedComponentPath = resolveComponentPathFromState(state, component);

      const result = await inspectComponentDiff(
        state.runId,
        componentName,
        resolvedComponentPath,
        component.protectedPaths || [],
        component.forbiddenPaths || [],
        state.baseDir || '.sea'
      );

      // Update component state
      // Preserve existing changedFiles from after-execution if available,
      // since diff inspection may return repo-wide files instead of component-scoped ones
      updatedComponentStates[componentName] = {
        ...componentState,
        changedFiles: componentState.changedFiles.length > 0
          ? componentState.changedFiles
          : result.changedFiles,
        forbiddenPathViolations: result.forbiddenPathViolations,
        protectedPathViolations: result.protectedPathViolations,
        diffPath: componentState.diffPath || `${state.runId}/components/${componentName}/diff.patch`,
      };

      allViolations.push(...result.forbiddenPathViolations);
      allViolations.push(...result.protectedPathViolations);
    }

    const hasViolations = allViolations.length > 0;

    return {
      componentStates: updatedComponentStates,
      errors: hasViolations
        ? [{
            timestamp: new Date().toISOString(),
            phase: 'diff-inspection',
            error: `Path violations found: ${allViolations.join(', ')}`,
            recoverable: false,
          }]
        : [],
    };
  };
}

async function inspectComponentDiff(
  runId: string,
  componentName: string,
  componentPath: string,
  protectedPaths: string[],
  forbiddenPaths: string[],
  baseDir: string
): Promise<DiffInspectionResult> {
  const paths = getRunPaths(runId, baseDir);
  const componentDir = paths.componentsDir;

  // Get git diff
  const diff = await getGitDiff(componentPath);
  const status = await getGitStatus(componentPath);

  // Save diff to file
  const diffPath = `${componentDir}/${componentName}/diff.patch`;
  const diffContent = diff.raw;

  // Check for forbidden/protected path violations
  const forbiddenPathViolations = checkForbiddenViolations(diff.files, forbiddenPaths);
  const protectedPathViolations = checkProtectedViolations(diff.files, protectedPaths);

  const warnings: string[] = [];

  // Check for large changes
  if (diff.insertions > 500) {
    warnings.push(`Large diff: ${diff.insertions} insertions`);
  }

  // Check for deletions
  if (diff.raw.includes('--- a/') && !diff.raw.includes('new file')) {
    warnings.push('Deletions detected - ensure no intentional removals');
  }

  return {
    changedFiles: diff.files,
    forbiddenPathViolations,
    protectedPathViolations,
    diffClean: forbiddenPathViolations.length === 0 && protectedPathViolations.length === 0,
    warnings,
  };
}

function checkForbiddenViolations(
  changedFiles: string[],
  forbiddenPaths: string[]
): string[] {
  if (forbiddenPaths.length === 0) return [];

  const violations: string[] = [];

  for (const file of changedFiles) {
    for (const pattern of forbiddenPaths) {
      if (matchPath(file, pattern)) {
        violations.push(`${file} matches forbidden pattern: ${pattern}`);
      }
    }
  }

  return violations;
}

function checkProtectedViolations(
  changedFiles: string[],
  protectedPaths: string[]
): string[] {
  if (protectedPaths.length === 0) return [];

  const violations: string[] = [];

  for (const file of changedFiles) {
    for (const pattern of protectedPaths) {
      if (matchPath(file, pattern)) {
        violations.push(`${file} matches protected pattern: ${pattern}`);
      }
    }
  }

  return violations;
}

function matchPath(file: string, pattern: string): boolean {
  // Simple glob matching
  const normalizedPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');

  const regex = new RegExp(`^${normalizedPattern}`);
  return regex.test(file) || file.includes(pattern.replace(/\*/g, ''));
}

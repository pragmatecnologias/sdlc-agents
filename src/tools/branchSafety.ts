/**
 * Branch Safety Module
 *
 * Captures git branch state before execution:
 * - Current branch per component
 * - HEAD commit hash
 * - Dirty status
 * - Optionally creates task branches (sea/<run-slug>)
 *
 * Used before `sea run` to warn/block on dirty repos
 * and to enable safe rollback.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { getGitStatus, captureSnapshot } from './gitTool.js';
import { getRunPaths } from '../workflow/checkpoint.js';
import { ComponentConfig } from '../state/schemas.js';

export interface ComponentBranchState {
  componentName: string;
  componentPath: string;
  branchBefore: string;
  headBefore: string;
  isDirty: boolean;
  branchCreated: string | null;
}

export interface BranchSafetyResult {
  runId: string;
  workspaceRoot: string;
  components: ComponentBranchState[];
  blocked: boolean;
  blockingComponents: string[];
}

export interface CreateBranchesResult {
  runId: string;
  branches: string[];        // branch names created
  componentBranchStates: ComponentBranchState[];
  failed: string[];
}

/**
 * Capture branch state for all components before execution.
 * Returns result with dirty warnings but does NOT block.
 */
export async function captureBranchSafety(
  runId: string,
  workspaceRoot: string,
  components: ComponentConfig[],
  baseDir: string = '.sea'
): Promise<BranchSafetyResult> {
  const componentStates: ComponentBranchState[] = [];
  const blockingComponents: string[] = [];

  for (const comp of components) {
    const compPath = path.isAbsolute(comp.path)
      ? comp.path
      : path.resolve(workspaceRoot, comp.path);

    let branchBefore = '';
    let headBefore = '';
    let isDirty = false;

    try {
      const status = await getGitStatus(compPath);
      branchBefore = status.currentBranch;
      isDirty = status.isDirty;

      // Get HEAD commit hash
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: compPath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      headBefore = commitHash;
    } catch {
      // Non-git repo or error — record what we can
      branchBefore = 'unknown';
      headBefore = 'unknown';
      isDirty = false;
    }

    const state: ComponentBranchState = {
      componentName: comp.name,
      componentPath: compPath,
      branchBefore,
      headBefore,
      isDirty,
      branchCreated: null,
    };

    componentStates.push(state);
  }

  return {
    runId,
    workspaceRoot,
    components: componentStates,
    blocked: blockingComponents.length > 0,
    blockingComponents,
  };
}

/**
 * Create task branches for components.
 * Branch name format: sea/<run-slug>
 *
 * By default, only creates branches for components with changeRole === 'modify'.
 * Pass onlyAllComponents: true to create branches for every component.
 *
 * Returns which branches were created and which failed.
 */
export async function createTaskBranches(
  runId: string,
  workspaceRoot: string,
  components: ComponentConfig[],
  baseDir: string = '.sea',
  options?: { onlyModifyComponents?: boolean; componentStates?: Record<string, { changeRole?: string }> }
): Promise<CreateBranchesResult> {
  const onlyModify = options?.onlyModifyComponents !== false; // default true
  const componentStates = options?.componentStates || {};
  // Derive a slug from runId (strip timestamp if run-${timestamp})
  const runSlug = runId.replace(/^run-\d+_/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
  const branchName = `sea/${runSlug}`;

  const branches: string[] = [];
  const failed: string[] = [];
  const componentBranchStates: ComponentBranchState[] = [];

  for (const comp of components) {
    // Skip non-modify components when onlyModify is true
    if (onlyModify) {
      const cs = componentStates[comp.name];
      if (cs && cs.changeRole && cs.changeRole !== 'modify') {
        componentBranchStates.push({
          componentName: comp.name,
          componentPath: path.isAbsolute(comp.path) ? comp.path : path.resolve(workspaceRoot, comp.path),
          branchBefore: '',
          headBefore: '',
          isDirty: false,
          branchCreated: null,
        });
        continue;
      }
    }

    const compPath = path.isAbsolute(comp.path)
      ? comp.path
      : path.resolve(workspaceRoot, comp.path);

    // Capture state before creating branch
    let branchBefore = '';
    let headBefore = '';
    let isDirty = false;

    try {
      const status = await getGitStatus(compPath);
      branchBefore = status.currentBranch;
      isDirty = status.isDirty;

      const commitHash = execSync('git rev-parse HEAD', {
        cwd: compPath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      headBefore = commitHash;

      // Create branch
      const result = execSync(`git checkout -b ${branchName}`, {
        cwd: compPath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      branches.push(`${comp.name}:${branchName}`);
      componentBranchStates.push({
        componentName: comp.name,
        componentPath: compPath,
        branchBefore,
        headBefore,
        isDirty,
        branchCreated: branchName,
      });
    } catch (error) {
      failed.push(comp.name);
      componentBranchStates.push({
        componentName: comp.name,
        componentPath: compPath,
        branchBefore,
        headBefore,
        isDirty,
        branchCreated: null,
      });
    }
  }

  return { runId, branches, componentBranchStates, failed };
}

/**
 * Check if any component is dirty. Returns list of dirty component names.
 */
export async function checkDirtyComponents(
  workspaceRoot: string,
  components: ComponentConfig[]
): Promise<string[]> {
  const dirty: string[] = [];

  for (const comp of components) {
    const compPath = path.isAbsolute(comp.path)
      ? comp.path
      : path.resolve(workspaceRoot, comp.path);

    try {
      const status = await getGitStatus(compPath);
      if (status.isDirty) {
        dirty.push(comp.name);
      }
    } catch {
      // Skip non-git repos
    }
  }

  return dirty;
}

/**
 * Save branch safety state to the run's directory.
 */
export async function saveBranchSafetyState(
  runId: string,
  branchSafety: BranchSafetyResult | CreateBranchesResult,
  baseDir: string = '.sea'
): Promise<void> {
  const paths = getRunPaths(runId, baseDir);
  await fs.mkdir(paths.runDir, { recursive: true });

  const statePath = path.join(paths.runDir, 'branch-safety.json');
  await fs.writeFile(statePath, JSON.stringify(branchSafety, null, 2), 'utf-8');
}

/**
 * Load branch safety state for a run.
 */
export async function loadBranchSafetyState(
  runId: string,
  baseDir: string = '.sea'
): Promise<BranchSafetyResult | null> {
  try {
    const paths = getRunPaths(runId, baseDir);
    const statePath = path.join(paths.runDir, 'branch-safety.json');
    const raw = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Format branch safety state for human-readable output.
 */
export function formatBranchSafetyReport(
  result: BranchSafetyResult | CreateBranchesResult,
  _verbose: boolean = false
): string {
  const isBranchSafety = 'blocked' in result;
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  Branch Safety Report');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Run ID:       ${result.runId}`);

  if (isBranchSafety) {
    lines.push(`  Workspace:    ${(result as BranchSafetyResult).workspaceRoot}`);
    lines.push(`  Blocked:      ${(result as BranchSafetyResult).blocked ? 'YES' : 'no'}`);
    const blocking = (result as BranchSafetyResult).blockingComponents;
    if (blocking.length > 0) {
      lines.push(`  Blocking:     ${blocking.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('  Components:');
  const allComponents: Array<{
    componentName: string;
    componentPath: string;
    branchBefore: string;
    headBefore: string;
    isDirty: boolean;
    branchCreated: string | null;
  }> = 'components' in result ? result.components : result.componentBranchStates;
  for (const comp of allComponents) {
    lines.push(`    ${comp.componentName}:`);
    lines.push(`      Branch:      ${comp.branchBefore}`);
    lines.push(`      HEAD:        ${comp.headBefore.substring(0, 8)}...`);
    lines.push(`      Dirty:       ${comp.isDirty ? 'YES' : 'no'}`);
    if (comp.branchCreated) {
      lines.push(`      Created:     ${comp.branchCreated}`);
    }
  }

  if (isBranchSafety && (result as BranchSafetyResult).blocked) {
    lines.push('');
    lines.push('  🔴 BLOCKED: One or more components are dirty.');
    lines.push('     Commit or stash changes before running sea plan/run.');
    lines.push('     Or use --skip-clean-check to bypass.');
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}
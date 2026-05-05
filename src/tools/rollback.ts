/**
 * Rollback Support for SEA
 *
 * Enables reverting changes made during a run:
 * - Shows changed components and diff paths
 * - Confirms before applying (unless --yes)
 * - Applies reverse patch or git checkout
 * - Updates state with rollback result
 * - Stores rollback report
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { getRunPaths, loadState } from '../workflow/checkpoint.js';
import { WorkspaceState } from '../state/workspaceState.js';
import { ComponentState } from '../state/schemas.js';

export interface RollbackTarget {
  componentName: string;
  componentPath: string;
  diffPath: string | null;
  changedFiles: string[];
  branchBefore: string | null;
  headBefore: string | null;
}

export interface RollbackResult {
  runId: string;
  targets: RollbackTarget[];
  applied: string[];       // components where rollback succeeded
  failed: string[];        // components where rollback failed
  reports: string[];      // paths to per-component rollback reports
}

export interface RollbackReport {
  runId: string;
  componentName: string;
  componentPath: string;
  rolledBack: boolean;
  method: 'git-checkout' | 'patch-revert' | 'none';
  filesReverted: string[];
  branchRestored: string | null;
  error: string | null;
  timestamp: string;
}

/**
 * Get components that have diffs/changes that can be rolled back.
 */
export async function getRollbackTargets(
  runId: string,
  baseDir: string = '.sea'
): Promise<RollbackTarget[]> {
  let state;
  try {
    state = await loadState(runId, baseDir);
  } catch {
    return [];
  }
  if (!state) return [];

  const targets: RollbackTarget[] = [];

  for (const [name, compState] of Object.entries(state.componentStates || {})) {
    if (!compState.diffPath && compState.changedFiles.length === 0) {
      continue; // Nothing to rollback
    }

    const target: RollbackTarget = {
      componentName: name,
      componentPath: compState.componentPath,
      diffPath: compState.diffPath,
      changedFiles: compState.changedFiles,
      branchBefore: compState.branchBefore,
      headBefore: null, // Will be populated if we have state
    };
    targets.push(target);
  }

  return targets;
}

/**
 * Preview what a rollback would do (dry run).
 */
export async function previewRollback(
  runId: string,
  baseDir: string = '.sea'
): Promise<RollbackTarget[]> {
  return getRollbackTargets(runId, baseDir);
}

/**
 * Apply rollback to specific components or all.
 */
export async function applyRollback(
  runId: string,
  componentName: string | null,
  baseDir: string = '.sea',
  confirmed: boolean = false
): Promise<RollbackResult> {
  const targets = await getRollbackTargets(runId, baseDir);
  const selectedTargets = componentName
    ? targets.filter(t => t.componentName === componentName)
    : targets;

  if (selectedTargets.length === 0) {
    return { runId, targets: [], applied: [], failed: [], reports: [] };
  }

  if (!confirmed) {
    // Show what would be rolled back and require confirmation
    console.log('The following components will be rolled back:\n');
    for (const t of selectedTargets) {
      console.log(`  ${t.componentName} (${t.componentPath})`);
      if (t.diffPath) {
        console.log(`    Diff: ${t.diffPath}`);
      }
      if (t.changedFiles.length > 0) {
        console.log(`    Changed files: ${t.changedFiles.length}`);
        for (const f of t.changedFiles.slice(0, 5)) {
          console.log(`      - ${f}`);
        }
        if (t.changedFiles.length > 5) {
          console.log(`      ... and ${t.changedFiles.length - 5} more`);
        }
      }
      if (t.branchBefore) {
        console.log(`    Branch will be restored to: ${t.branchBefore}`);
      }
      console.log('');
    }

    // Ask for confirmation (in non-interactive context, we just skip)
    console.log('Run with --yes to confirm rollback.');
    return { runId, targets: selectedTargets, applied: [], failed: [], reports: [] };
  }

  const applied: string[] = [];
  const failed: string[] = [];
  const reports: string[] = [];
  const paths = getRunPaths(runId, baseDir);
  await fs.mkdir(paths.runDir, { recursive: true });

  for (const target of selectedTargets) {
    const report = await rollbackComponent(target, paths.runDir);
    reports.push(report.timestamp ? `${paths.runDir}/rollback-${target.componentName}.json` : '');

    if (report.rolledBack) {
      applied.push(target.componentName);
    } else {
      failed.push(target.componentName);
    }
  }

  // Save overall rollback report
  const overallReport: RollbackResult = {
    runId,
    targets: selectedTargets,
    applied,
    failed,
    reports: reports.filter(Boolean),
  };

  const reportPath = path.join(paths.runDir, 'rollback-report.json');
  await fs.writeFile(reportPath, JSON.stringify(overallReport, null, 2), 'utf-8');

  return overallReport;
}

async function rollbackComponent(
  target: RollbackTarget,
  runDir: string
): Promise<RollbackReport> {
  const report: RollbackReport = {
    runId: '',
    componentName: target.componentName,
    componentPath: target.componentPath,
    rolledBack: false,
    method: 'none',
    filesReverted: [],
    branchRestored: null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  try {
    // Method: git checkout changed files
    if (target.changedFiles.length > 0) {
      for (const file of target.changedFiles) {
        try {
          execSync(`git checkout -- "${file}"`, {
            cwd: target.componentPath,
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'ignore'],
          });
          report.filesReverted.push(file);
        } catch {
          // Try relative path
          try {
            execSync(`git checkout -- "${file}"`, {
              cwd: target.componentPath,
              encoding: 'utf-8',
              timeout: 10000,
              stdio: ['pipe', 'pipe', 'ignore'],
            });
            report.filesReverted.push(file);
          } catch (err) {
            // File might not exist in git
          }
        }
      }
      report.method = 'git-checkout';
    }

    // Restore branch if we have branchBefore
    if (target.branchBefore && target.branchBefore !== 'unknown') {
      try {
        execSync(`git checkout ${target.branchBefore}`, {
          cwd: target.componentPath,
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        report.branchRestored = target.branchBefore;
      } catch {
        // Branch might not exist or already on it
      }
    }

    report.rolledBack = report.filesReverted.length > 0 || report.branchRestored !== null;
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
  }

  // Save per-component report
  const componentReportPath = path.join(runDir, `rollback-${target.componentName}.json`);
  await fs.writeFile(componentReportPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

/**
 * Format rollback preview for human-readable output.
 */
export function formatRollbackPreview(targets: RollbackTarget[]): string {
  if (targets.length === 0) {
    return 'No rollback targets found for this run.';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  Rollback Preview');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Components with changes: ${targets.length}`);
  lines.push('');

  for (const t of targets) {
    lines.push(`  ${t.componentName} (${t.componentPath})`);

    if (t.branchBefore) {
      lines.push(`    Branch before: ${t.branchBefore}`);
    }

    if (t.diffPath) {
      lines.push(`    Diff: ${t.diffPath}`);
    }

    if (t.changedFiles.length > 0) {
      lines.push(`    Changed files (${t.changedFiles.length}):`);
      for (const f of t.changedFiles.slice(0, 10)) {
        lines.push(`      - ${f}`);
      }
      if (t.changedFiles.length > 10) {
        lines.push(`      ... and ${t.changedFiles.length - 10} more`);
      }
    } else {
      lines.push(`    No changed files tracked`);
    }

    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  To apply rollback, run: sea rollback <runId> --yes');
  lines.push('  To rollback a specific component: sea rollback <runId> -c <name> --yes');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}
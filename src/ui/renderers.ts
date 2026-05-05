/**
 * UI Renderers for SEA CLI
 *
 * Reusable terminal rendering functions for human-readable output.
 * Each renderer is pure and returns a string (or void for side-effects).
 */

import { NextAction, determineNextAction, getMissingEvidence, formatNextActionCommand } from '../services/nextActionService.js';
import { RunSummary } from '../services/workspaceService.js';
import { WorkspaceState } from '../state/workspaceState.js';
import { WorkspaceValidationResult } from '../tools/workspaceValidator.js';
import { BranchSafetyResult, loadBranchSafetyState, formatBranchSafetyReport } from '../tools/branchSafety.js';

// ============================================================================
// Console Renderer
// ============================================================================

export function printBanner(title: string, width = 80): void {
  const line = '═'.repeat(Math.min(title.length + 4, width));
  console.log('\n' + line);
  console.log(`  ${title}`);
  console.log(line);
}

export function printSection(title: string, lines: string[]): void {
  console.log(`\n## ${title}`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

export function printKeyValue(key: string, value: string, width = 22): void {
  console.log(`  ${key.padEnd(width)} ${value}`);
}

export function printList(items: string[], bullet = '•'): void {
  for (const item of items) {
    console.log(`  ${bullet} ${item}`);
  }
}

export function printDivider(): void {
  console.log('\n──────────────────────────────────────────────────────────');
}

// ============================================================================
// Run Board Renderer
// ============================================================================

export interface BranchSafetyDisplay {
  componentName: string;
  branchBefore: string;
  headBeforeShort: string;
  dirtyBefore: boolean;
  branchCreated: string | null;
}

export interface StatusDisplay {
  runId: string;
  runStatus: string;
  userRequest: string;
  createdAt: string;
  updatedAt: string;
  currentPhase: string;
  components: ComponentStatusDisplay[];
  missingEvidence: string[];
  blockers: string[];
  nextAction: NextAction;
  branchSafety: BranchSafetyDisplay[];
}

export interface ComponentStatusDisplay {
  name: string;
  role: string;
  changeRole: string;
  decision: string;
  executorStatus: string;
  changedFiles: number;
  diffPath: string | null;
  commandResultsCount: number;
  artifactInspectionStatus: string;
  nextActionHint: string;
}

/**
 * Render a run board (sea status output)
 */
export function renderRunBoard(display: StatusDisplay, workspacePath: string): void {
  printBanner(`SEA Run Status`);

  printKeyValue('Run', display.runId);
  printKeyValue('Status', display.runStatus);
  printKeyValue('Request', display.userRequest.substring(0, 60) + (display.userRequest.length > 60 ? '...' : ''));
  printKeyValue('Updated', new Date(display.updatedAt).toLocaleString());
  if (display.currentPhase) {
    printKeyValue('Phase', display.currentPhase);
  }

  printDivider();

  // Component matrix
  console.log('\nComponents');
  console.log('─'.repeat(76));
  console.log('  Component      Role     ChangeRole   Decision    Changed  Cmds  Artifact  Next');
  console.log('─'.repeat(76));

  for (const c of display.components) {
    const name = c.name.padEnd(14).substring(0, 14);
    const role = c.role.padEnd(9).substring(0, 9);
    const changeRole = c.changeRole.padEnd(12).substring(0, 12);
    const decision = c.decision.padEnd(10).substring(0, 10);
    const changed = String(c.changedFiles).padStart(7);
    const cmds = String(c.commandResultsCount).padStart(4);
    const artifact = c.artifactInspectionStatus.padEnd(9).substring(0, 9);
    const next = c.nextActionHint.substring(0, 12);

    console.log(`  ${name} ${role} ${changeRole} ${decision} ${changed} ${cmds} ${artifact} ${next}`);
  }

  // Missing evidence
  if (display.missingEvidence.length > 0) {
    printDivider();
    console.log('\nMissing Evidence');
    printList(display.missingEvidence);
  }

  // Branch safety
  if (display.branchSafety.length > 0) {
    printDivider();
    console.log('\nBranch Safety');
    console.log('  Component        Branch            HEAD       Dirty  Created');
    console.log('  ' + '─'.repeat(72));
    for (const bs of display.branchSafety) {
      const name = bs.componentName.padEnd(16).substring(0, 16);
      const branch = (bs.branchBefore || '-').padEnd(17).substring(0, 17);
      const head = bs.headBeforeShort.padEnd(10).substring(0, 10);
      const dirty = bs.dirtyBefore ? 'YES    ' : 'no     ';
      const created = bs.branchCreated || '-';
      console.log(`  ${name} ${branch} ${head} ${dirty} ${created}`);
    }
  }

  // Blockers
  if (display.blockers.length > 0) {
    printDivider();
    console.log('\nBlockers');
    printList(display.blockers, '🔴');
  }

  // Next action
  printDivider();
  console.log('\nNext Recommended Action');
  console.log(`  ${display.nextAction.reason}`);
  const runCmd = formatNextActionCommand(display.nextAction, workspacePath);
  if (runCmd) {
    console.log(`\n  Command:`);
    console.log(`    ${runCmd}`);
  }
  if (display.nextAction.component) {
    console.log(`  Component: ${display.nextAction.component}`);
  }
}

/**
 * Render status as JSON
 */
export function renderStatusJson(display: StatusDisplay, workspacePath: string): string {
  return JSON.stringify({
    runId: display.runId,
    runStatus: display.runStatus,
    userRequest: display.userRequest,
    createdAt: display.createdAt,
    updatedAt: display.updatedAt,
    currentPhase: display.currentPhase,
    workspacePath,
    components: display.components.map(c => ({
      name: c.name,
      role: c.role,
      changeRole: c.changeRole,
      decision: c.decision,
      executorStatus: c.executorStatus,
      changedFiles: c.changedFiles,
      diffPath: c.diffPath,
      commandResultsCount: c.commandResultsCount,
      artifactInspectionStatus: c.artifactInspectionStatus,
    })),
    branchSafety: display.branchSafety.map(bs => ({
      componentName: bs.componentName,
      branchBefore: bs.branchBefore,
      headBefore: bs.headBeforeShort,
      dirtyBefore: bs.dirtyBefore,
      branchCreated: bs.branchCreated,
    })),
    missingEvidence: display.missingEvidence,
    blockers: display.blockers,
    nextAction: {
      ...display.nextAction,
      command: formatNextActionCommand(display.nextAction, workspacePath),
    },
  }, null, 2);
}

// ============================================================================
// Next Action Renderer
// ============================================================================

export function renderNextAction(action: NextAction, workspacePath: string): void {
  printBanner('Next Action');

  console.log(`\n  ${action.reason}`);

  if (action.component) {
    console.log(`  Component: ${action.component}`);
  }

  if (action.details && action.details.length > 0) {
    console.log('\n  Details:');
    for (const detail of action.details) {
      console.log(`    - ${detail}`);
    }
  }

  const cmd = formatNextActionCommand(action, workspacePath);
  if (cmd) {
    console.log(`\n  Command:`);
    console.log(`    ${cmd}`);
  }

  console.log(`\n  Can run interactively: ${action.canRunInteractively ? 'Yes' : 'No'}`);
}

export function renderNextActionJson(action: NextAction, workspacePath?: string): string {
  const output: Record<string, unknown> = { ...action };
  if (workspacePath) {
    output.command = formatNextActionCommand(action, workspacePath);
  }
  return JSON.stringify(output, null, 2);
}

// ============================================================================
// Recent Runs Renderer
// ============================================================================

export function renderRecentRuns(runs: RunSummary[], workspacePath: string): void {
  printBanner('Recent Runs');

  if (runs.length === 0) {
    console.log('  No runs found.');
    console.log('\n  Run `sea run "<request>"` to start a new engineering run.');
    return;
  }

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const idx = String(i + 1).padStart(2);
    const status = run.runStatus.padEnd(24).substring(0, 24);
    const request = run.userRequest.substring(0, 50) + (run.userRequest.length > 50 ? '...' : '');
    const updated = new Date(run.updatedAt).toLocaleString();

    console.log(`\n  ${idx}. ${run.runId}`);
    console.log(`     Status: ${status}`);
    console.log(`     Request: ${request}`);
    console.log(`     Updated: ${updated}`);
  }

  console.log(`\n  Workspace: ${workspacePath}`);
  console.log('\n  Options:');
  console.log('    sea status <runId> -w <workspace>   View run details');
  console.log('    sea next <runId> -w <workspace>    Show next action');
  console.log('    sea resume <runId> -w <workspace>  Resume run');
}

export function renderRecentRunsJson(runs: RunSummary[]): string {
  return JSON.stringify(runs, null, 2);
}

// ============================================================================
// Validation Renderer
// ============================================================================

export function renderValidationResult(result: WorkspaceValidationResult): void {
  printBanner(`Workspace Validation: ${result.workspaceName}`);

  printKeyValue('Workspace', result.workspacePath);
  printKeyValue('Root', result.workspaceRoot);
  printKeyValue('Profile', result.profile || '(none)');
  printKeyValue('Components', String(result.componentCount));
  printKeyValue('Status', result.status.toUpperCase());

  if (result.errors.length > 0) {
    printDivider();
    console.log('\nErrors');
    for (const err of result.errors) {
      console.log(`  🔴 ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    printDivider();
    console.log('\nWarnings');
    for (const warn of result.warnings) {
      console.log(`  🟡 ${warn}`);
    }
  }

  if (result.componentResults.length > 0) {
    printDivider();
    console.log('\nComponent Results');
    for (const cr of result.componentResults) {
      const status = cr.exists ? '✅' : '❌';
      console.log(`\n  ${status} ${cr.name} (${cr.path})`);

      for (const err of cr.errors) {
        console.log(`     🔴 ${err}`);
      }
      for (const warn of cr.warnings) {
        console.log(`     🟡 ${warn}`);
      }
    }
  }

  console.log('');
}

export function renderValidationJson(result: WorkspaceValidationResult): string {
  return JSON.stringify({
    workspacePath: result.workspacePath,
    workspaceRoot: result.workspaceRoot,
    workspaceName: result.workspaceName,
    profile: result.profile,
    componentCount: result.componentCount,
    status: result.status,
    errors: result.errors,
    warnings: result.warnings,
    componentResults: result.componentResults.map(cr => ({
      name: cr.name,
      path: cr.path,
      exists: cr.exists,
      isDirectory: cr.isDirectory,
      isGitRepo: cr.isGitRepo,
      errors: cr.errors,
      warnings: cr.warnings,
    })),
  }, null, 2);
}

// ============================================================================
// Report Renderer
// ============================================================================

export async function renderReport(state: WorkspaceState, workspacePath: string): Promise<void> {
  printBanner(`SEA Run Report: ${state.runId}`);

  // Run summary
  printKeyValue('Run', state.runId);
  printKeyValue('Status', state.runStatus);
  printKeyValue('Request', state.userRequest.substring(0, 60) + (state.userRequest.length > 60 ? '...' : ''));
  printKeyValue('Created', new Date(state.createdAt).toLocaleString());
  printKeyValue('Updated', new Date(state.updatedAt).toLocaleString());

  // Component matrix
  printDivider();
  console.log('\nComponent Matrix');

  const componentNames = Object.keys(state.componentStates);

  if (componentNames.length === 0) {
    console.log('  No components in state.');
  } else {
    for (const name of componentNames) {
      const cs = state.componentStates[name];
      const component = state.workspace.components?.find(c => c.name === name);

      console.log(`\n  ${name} (${cs.role || component?.role || 'unknown'})`);
      printKeyValue('  ChangeRole', cs.changeRole || 'unknown', 14);
      printKeyValue('  Decision', cs.componentDecision || 'pending', 14);
      printKeyValue('  Executor', cs.executorResult?.status || 'n/a', 14);

      const changedCount = cs.changedFiles?.length || 0;
      printKeyValue('  Changed', `${changedCount} file(s)`, 14);

      if (cs.diffPath) {
        console.log(`  diff: ${cs.diffPath}`);
      }

      if (cs.commandResults && cs.commandResults.length > 0) {
        console.log(`  Commands: ${cs.commandResults.length} run`);
        for (const cr of cs.commandResults) {
          const icon = cr.status === 'passed' ? '✅' : cr.status === 'failed' ? '❌' : '⚠️';
          console.log(`    ${icon} ${cr.commandName}: ${cr.status} (${cr.durationMs}ms)`);
        }
      }

      if (cs.artifactInspection) {
        const ai = cs.artifactInspection;
        const aiIcon = ai.valid === false ? '❌' : '✅';
        console.log(`  Artifact: ${aiIcon} ${ai.artifactType} - ${ai.fileCount || 0} files`);
      }
    }
  }

  // Evidence paths
  printDivider();
  console.log('\nEvidence Paths');

  const diffPaths: string[] = [];
  const stdoutPaths: string[] = [];

  for (const [name, cs] of Object.entries(state.componentStates)) {
    if (cs.diffPath) diffPaths.push(`${name}: ${cs.diffPath}`);
    if (cs.commandResults) {
      for (const cr of cs.commandResults) {
        if (cr.stdoutPath) stdoutPaths.push(`${name}.${cr.commandName}: ${cr.stdoutPath}`);
      }
    }
  }

  if (diffPaths.length > 0) {
    console.log('\n  Diffs:');
    for (const p of diffPaths) console.log(`    ${p}`);
  }
  if (stdoutPaths.length > 0) {
    console.log('\n  Command Outputs:');
    for (const p of stdoutPaths) console.log(`    ${p}`);
  }

  if (diffPaths.length === 0 && stdoutPaths.length === 0) {
    console.log('  No evidence captured yet.');
  }

  // Branch safety
  try {
    const baseDir = state.baseDir || '.sea';
    const branchSafety = await loadBranchSafetyState(state.runId, baseDir);
    if (branchSafety && 'components' in branchSafety) {
      printDivider();
      console.log('\nBranch Safety');
      const components = (branchSafety as BranchSafetyResult).components;
      if (components.length > 0) {
        console.log('  Component        Branch            HEAD       Dirty  Created');
        console.log('  ' + '─'.repeat(72));
        for (const comp of components) {
          const name = comp.componentName.padEnd(16).substring(0, 16);
          const branch = (comp.branchBefore || '-').padEnd(17).substring(0, 17);
          const head = comp.headBefore.substring(0, 8).padEnd(10);
          const dirty = comp.isDirty ? 'YES    ' : 'no     ';
          const created = comp.branchCreated || '-';
          console.log(`  ${name} ${branch} ${head} ${dirty} ${created}`);
        }
      }
    }
  } catch {
    // Branch safety data not available
  }

  // Final decision
  if (state.finalDecision) {
    printDivider();
    console.log('\nFinal Decision');
    const verdict = state.finalDecision.decision;
    const verdictIcon = verdict === 'APPROVED' ? '✅' : verdict === 'APPROVED_WITH_NOTES' ? '⚠️' : verdict === 'NEEDS_FIXES' ? '🟡' : '❌';
    console.log(`  ${verdictIcon} ${verdict}`);
    if (state.finalDecision.summary) {
      console.log(`  Summary: ${state.finalDecision.summary}`);
    }
    if (state.finalDecision.score !== undefined) {
      console.log(`  Score: ${state.finalDecision.score}/100`);
    }
  }

  // Next action
  if (state.runStatus !== 'completed' && state.runStatus !== 'failed') {
    const nextAction = determineNextAction(state);
    const nextCmd = formatNextActionCommand(nextAction, workspacePath);
    printDivider();
    console.log('\nNext Action');
    console.log(`  Status: ${state.runStatus}`);
    console.log(`  ${nextAction.reason}`);
    if (nextCmd) {
      console.log(`  Command: ${nextCmd}`);
    }
  }

  console.log('');
}

export async function renderReportJson(state: WorkspaceState, workspacePath: string): Promise<string> {
  const components = Object.entries(state.componentStates).map(([name, cs]) => ({
    name,
    role: cs.role,
    changeRole: cs.changeRole,
    decision: cs.componentDecision,
    executorStatus: cs.executorResult?.status,
    changedFiles: cs.changedFiles || [],
    diffPath: cs.diffPath,
    commandResults: (cs.commandResults || []).map(cr => ({
      commandName: cr.commandName,
      status: cr.status,
      exitCode: cr.exitCode,
      durationMs: cr.durationMs,
      stdoutPath: cr.stdoutPath,
      stderrPath: cr.stderrPath,
    })),
    artifactInspection: cs.artifactInspection ? {
      artifactType: cs.artifactInspection.artifactType,
      valid: cs.artifactInspection.valid,
      fileCount: cs.artifactInspection.fileCount,
      entries: cs.artifactInspection.entries,
    } : null,
  }));

  // Load branch safety
  let branchSafetyData: BranchSafetyDisplay[] = [];
  try {
    const baseDir = state.baseDir || '.sea';
    const branchSafety = await loadBranchSafetyState(state.runId, baseDir);
    if (branchSafety && 'components' in branchSafety) {
      branchSafetyData = (branchSafety as BranchSafetyResult).components.map(comp => ({
        componentName: comp.componentName,
        branchBefore: comp.branchBefore,
        headBeforeShort: comp.headBefore.substring(0, 8),
        dirtyBefore: comp.isDirty,
        branchCreated: comp.branchCreated,
      }));
    }
  } catch {
    // Branch safety not available
  }

  return JSON.stringify({
    runId: state.runId,
    runStatus: state.runStatus,
    userRequest: state.userRequest,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    workspacePath,
    components,
    branchSafety: branchSafetyData,
    finalDecision: state.finalDecision,
    nextAction: (() => {
      const na = determineNextAction(state);
      return {
        type: na.type,
        reason: na.reason,
        command: formatNextActionCommand(na, workspacePath),
      };
    })(),
  }, null, 2);
}

// ============================================================================
// Execution Request Renderer
// ============================================================================

export function renderExecutionRequest(requestPath: string, componentName: string, runId: string, workspacePath: string): void {
  printBanner(`Execution Request: ${componentName}`);

  console.log(`\n  File: ${requestPath}`);
  console.log(`\n  Run: ${runId}`);
  console.log(`\n  When done, capture evidence with:`);
  console.log(`    sea after-execution ${runId} -c ${componentName} -w ${workspacePath}`);
  console.log('');
}

// ============================================================================
// Run Board Builder (shared between CLI status command and interactive UI)
// ============================================================================

export function getComponentNextHint(name: string, cs: Record<string, unknown>): string {
  if (cs.changeRole === 'no_change' || cs.changeRole === 'unknown') {
    return 'skip';
  }

  const diffPath = cs.diffPath as string | null;
  const changedFiles = cs.changedFiles as string[] | undefined;
  const commandResults = cs.commandResults as Array<Record<string, unknown>> | undefined;

  if (!diffPath && (!changedFiles || changedFiles.length === 0)) {
    return 'await';
  }

  if (!commandResults || commandResults.length === 0) {
    return 'verify';
  }

  return 'done';
}

/**
 * Build a StatusDisplay from WorkspaceState.
 * Used by both CLI status command and interactive UI.
 */
export async function buildStatusDisplay(state: WorkspaceState, workspacePath: string): Promise<StatusDisplay> {
  const components: ComponentStatusDisplay[] = [];

  for (const [name, cs] of Object.entries(state.componentStates)) {
    const component = state.workspace.components?.find(c => c.name === name);
    const nextActionHint = getComponentNextHint(name, cs);

    components.push({
      name,
      role: component?.role || (cs as Record<string, unknown>).role as string || 'unknown',
      changeRole: (cs.changeRole as string) || 'unknown',
      decision: (cs.componentDecision as string) || 'pending',
      executorStatus: (cs.executorResult as Record<string, unknown>)?.status as string || 'pending',
      changedFiles: (cs.changedFiles as string[])?.length || 0,
      diffPath: (cs.diffPath as string) || null,
      commandResultsCount: (cs.commandResults as Array<Record<string, unknown>>)?.length || 0,
      artifactInspectionStatus: cs.artifactInspection
        ? ((cs.artifactInspection as Record<string, unknown>).valid === false ? 'failed' : 'passed')
        : 'missing',
      nextActionHint,
    });
  }

  const nextAction = determineNextAction(state);
  const missingEvidence = getMissingEvidence(state);

  // Load branch safety data
  let branchSafety: BranchSafetyDisplay[] = [];
  try {
    const baseDir = state.baseDir || '.sea';
    const bsResult = await loadBranchSafetyState(state.runId, baseDir);
    if (bsResult && 'components' in bsResult) {
      branchSafety = (bsResult as BranchSafetyResult).components.map(comp => ({
        componentName: comp.componentName,
        branchBefore: comp.branchBefore,
        headBeforeShort: comp.headBefore.substring(0, 8),
        dirtyBefore: comp.isDirty,
        branchCreated: comp.branchCreated,
      }));
    }
  } catch {
    // Branch safety not available
  }

  return {
    runId: state.runId,
    runStatus: state.runStatus,
    userRequest: state.userRequest,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    currentPhase: state.currentPhase || '',
    components,
    missingEvidence,
    blockers: (state.errors || []).map(e => (e as { error?: string }).error || String(e)),
    nextAction,
    branchSafety,
  };
}

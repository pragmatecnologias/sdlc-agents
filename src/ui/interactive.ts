/**
 * Interactive CLI for SEA
 *
 * A guided terminal control panel that leads the user through the SEA workflow.
 * Uses @inquirer/prompts for interactive input.
 *
 * This module is the top-level entry point for interactive mode.
 * It orchestrates the main menu and sub-flows.
 */

import * as path from 'path';
import { spawn } from 'child_process';
import {
  input,
  select,
  confirm,
} from '@inquirer/prompts';
import { WorkspaceState } from '../state/workspaceState.js';
import {
  findWorkspaceFromCwd,
  loadWorkspace,
  resolveWorkspacePath,
  listRecentRuns,
  getRunState,
} from '../services/workspaceService.js';
import { determineNextAction, NextAction, getMissingEvidence } from '../services/nextActionService.js';
import {
  renderRunBoard,
  renderRecentRuns,
  renderNextAction,
  renderValidationResult,
  renderReport,
  printBanner,
  printDivider,
  buildStatusDisplay,
} from '../ui/renderers.js';
import { validateWorkspaceConfig } from '../tools/workspaceValidator.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('InteractiveCLI');

function getSeaBin(): string {
  return path.resolve(__dirname, '../../dist/index.js');
}

function runSeaCommand(args: string[], workspacePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [getSeaBin(), ...args, '-w', workspacePath], {
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

// ============================================================================
// Entry Point
// ============================================================================

export async function runInteractiveMode(): Promise<void> {
  console.log('\n🔵 SEA Control Panel\n');

  const workspaceDetection = await findWorkspaceFromCwd(process.cwd());

  let workspacePath: string;

  if (!workspaceDetection.found) {
    console.log('No SEA workspace detected in the current directory tree.');
    const inputPath = await input({
      message: 'Enter path to workspace (.sea/workspace.json or parent directory):',
      default: '.',
    });

    const resolved = resolveWorkspacePath(inputPath || '.');
    try {
      await loadWorkspace(resolved);
      workspacePath = resolved;
      console.log(`\n✅ Using workspace: ${workspacePath}`);
    } catch {
      console.log('\n❌ Could not load workspace at that path. Exiting.');
      return;
    }
  } else {
    workspacePath = workspaceDetection.workspacePath!;
    console.log(`✅ Detected workspace: ${workspaceDetection.workspaceName || workspacePath}`);
  }

  await showMainMenu(workspacePath);
}

// ============================================================================
// Main Menu
// ============================================================================

async function showMainMenu(workspacePath: string): Promise<void> {
  const choices = [
    { name: 'Start new engineering run', value: 'start' },
    { name: 'Continue existing run', value: 'continue' },
    { name: 'View run status', value: 'status' },
    { name: 'Show next recommended action', value: 'next' },
    { name: 'Validate workspace', value: 'validate' },
    { name: 'Search memory', value: 'memory' },
    { name: 'Exit', value: 'exit' },
  ];

  const answer = await select({
    message: 'What would you like to do?',
    choices,
  });

  switch (answer) {
    case 'start':
      await handleStartRun(workspacePath);
      break;
    case 'continue':
      await handleContinueRun(workspacePath);
      break;
    case 'status':
      await handleStatusInteractive(workspacePath);
      break;
    case 'next':
      await handleNextInteractive(workspacePath);
      break;
    case 'validate':
      await handleValidate(workspacePath);
      break;
    case 'memory':
      await handleMemory(workspacePath);
      break;
    case 'exit':
      console.log('\nGoodbye!\n');
      return;
  }

  await showMainMenu(workspacePath);
}

// ============================================================================
// Start New Run
// ============================================================================

async function handleStartRun(workspacePath: string): Promise<void> {
  console.log('\n--- Start New Engineering Run ---\n');

  const request = await input({
    message: 'What engineering task do you want SEA to plan?',
    validate: (value: string) => value.trim().length > 0 || 'Request cannot be empty.',
  });

  const runMode = await select({
    message: 'Choose run mode:',
    choices: [
      { name: 'Plan only (no execution)', value: 'plan' },
      { name: 'Run until manual execution pause', value: 'run' },
    ],
  });

  console.log(`\n🔄 Starting run in ${runMode === 'plan' ? 'planning' : 'full workflow'} mode...`);

  try {
    if (runMode === 'plan') {
      await runSeaCommand(['plan', request], workspacePath);
    } else {
      await runSeaCommand(['run', request], workspacePath);
    }
  } catch (e) {
    console.log('\n❌ Run failed. Check your workspace configuration.');
    return;
  }

  const runs = await listRecentRuns(workspacePath, 1);
  if (runs.length > 0) {
    const runId = runs[0].runId;
    printDivider();
    console.log(`\n✅ Run created: ${runId}`);
    console.log(`   Status: awaiting_manual_execution`);

    const stateResult = await getRunState(runId, workspacePath);
    if (stateResult) {
      const state = stateResult.state as unknown as WorkspaceState;
      const nextAction = determineNextAction(state);
      console.log('\n   Next:', nextAction.reason);
      if (nextAction.command) {
        console.log(`   ${nextAction.command.replace('<workspace>', workspacePath)}`);
      }
    }
  }

  await input({ message: 'Press Enter to continue...' });
}

// ============================================================================
// Continue Existing Run
// ============================================================================

async function handleContinueRun(workspacePath: string): Promise<void> {
  console.log('\n--- Continue Existing Run ---\n');

  const runs = await listRecentRuns(workspacePath);

  if (runs.length === 0) {
    console.log('  No runs found. Start a new run first.');
    return;
  }

  renderRecentRuns(runs, workspacePath);

  const runIdInput = await input({
    message: '\nEnter run ID to continue:',
    validate: (value: string) => value.trim().length > 0 || 'Run ID required.',
  });

  const runId = runIdInput.trim();
  const stateResult = await getRunState(runId, workspacePath);

  if (!stateResult) {
    console.log(`\n❌ Run ${runId} not found.`);
    return;
  }

  const state = stateResult.state as unknown as WorkspaceState;
  await showRunBoardInteractive(state, workspacePath);
}

// ============================================================================
// Status (interactive)
// ============================================================================

async function handleStatusInteractive(workspacePath: string): Promise<void> {
  const runs = await listRecentRuns(workspacePath);

  if (runs.length === 0) {
    console.log('\n  No runs found. Start a new run first.');
    return;
  }

  const runChoices = runs.map(r => ({ name: `${r.runId} — ${r.userRequest.substring(0, 40)}`, value: r.runId }));
  runChoices.push({ name: 'Cancel', value: '__cancel__' });

  const runId = await select({
    message: 'Select a run:',
    choices: runChoices,
  });

  if (runId === '__cancel__') return;

  const stateResult = await getRunState(runId as string, workspacePath);
  if (!stateResult) {
    console.log(`\n❌ Run ${runId} not found.`);
    return;
  }

  const state = stateResult.state as unknown as WorkspaceState;
  const display = buildStatusDisplay(state, workspacePath);
  renderRunBoard(display, workspacePath);
}

// ============================================================================
// Next Action (interactive)
// ============================================================================

async function handleNextInteractive(workspacePath: string): Promise<void> {
  const runs = await listRecentRuns(workspacePath);

  if (runs.length === 0) {
    console.log('\n  No runs found. Start a new run first.');
    return;
  }

  const runChoices = runs.map(r => ({ name: `${r.runId} — ${r.userRequest.substring(0, 40)}`, value: r.runId }));
  runChoices.push({ name: 'Cancel', value: '__cancel__' });

  const runId = await select({
    message: 'Select a run:',
    choices: runChoices,
  });

  if (runId === '__cancel__') return;

  const stateResult = await getRunState(runId as string, workspacePath);
  if (!stateResult) {
    console.log(`\n❌ Run ${runId} not found.`);
    return;
  }

  const state = stateResult.state as unknown as WorkspaceState;
  const nextAction = determineNextAction(state);
  renderNextAction(nextAction, workspacePath);
}

// ============================================================================
// Validate Workspace
// ============================================================================

async function handleValidate(workspacePath: string): Promise<void> {
  console.log('\n--- Validate Workspace ---\n');

  const result = await validateWorkspaceConfig(workspacePath);
  renderValidationResult(result);
}

// ============================================================================
// Memory Search
// ============================================================================

async function handleMemory(workspacePath: string): Promise<void> {
  console.log('\n--- Search Memory ---\n');

  const query = await input({
    message: 'Enter search term:',
    validate: (value: string) => value.trim().length > 0 || 'Query cannot be empty.',
  });

  try {
    await runSeaCommand(['memory', query], workspacePath);
  } catch (e) {
    console.log('\n❌ Memory search failed.');
  }
}

// ============================================================================
// Run Board Interactive
// ============================================================================

async function showRunBoardInteractive(state: WorkspaceState, workspacePath: string): Promise<void> {
  const display = buildStatusDisplay(state, workspacePath);
  renderRunBoard(display, workspacePath);

  const nextAction = determineNextAction(state);
  const availableActions = getAvailableActions(state, nextAction);

  if (availableActions.length === 0) {
    console.log('\n  No actions available for this run.');
    return;
  }

  const choice = await select({
    message: 'Choose an action:',
    choices: availableActions,
  });

  await executeAction(state, choice as string, workspacePath);
}

function getAvailableActions(state: WorkspaceState, nextAction: NextAction): Array<{ name: string; value: string }> {
  const actions: Array<{ name: string; value: string }> = [];

  switch (nextAction.type) {
    case 'OPEN_EXECUTION_REQUEST':
      if (nextAction.component) {
        actions.push({ name: `Open execution request for ${nextAction.component}`, value: `request:${nextAction.component}` });
      }
      break;

    case 'CAPTURE_EVIDENCE':
      if (nextAction.component) {
        actions.push({ name: `Capture evidence for ${nextAction.component}`, value: `evidence:${nextAction.component}` });
      }
      break;

    case 'RUN_VERIFICATION':
      actions.push({ name: 'Run verification', value: 'verify' });
      break;

    case 'INSPECT_ARTIFACT':
      if (nextAction.component) {
        actions.push({ name: `Inspect artifact for ${nextAction.component}`, value: `artifact:${nextAction.component}` });
      }
      break;

    case 'RESUME':
      actions.push({ name: 'Resume run to final decision', value: 'resume' });
      break;

    case 'SHOW_REPORT':
      actions.push({ name: 'Show report', value: 'report' });
      break;

    case 'FIX_BLOCKER':
      actions.push({ name: 'Show blockers', value: 'blockers' });
      break;
  }

  actions.push({ name: 'Show full report', value: 'report' });
  actions.push({ name: 'Back to menu', value: 'back' });

  return actions;
}

async function executeAction(state: WorkspaceState, action: string, workspacePath: string): Promise<void> {
  const [actionType, target] = action.split(':');

  switch (actionType) {
    case 'request':
      await handleOpenRequest(state.runId, target, workspacePath);
      break;
    case 'evidence':
      await handleCaptureEvidence(state.runId, target, workspacePath);
      break;
    case 'verify':
      await handleRunVerification(state.runId, workspacePath);
      break;
    case 'artifact':
      await handleInspectArtifact(state.runId, target, workspacePath);
      break;
    case 'resume':
      await handleResume(state.runId, workspacePath);
      break;
    case 'report':
      await handleShowReport(state, workspacePath);
      break;
    case 'blockers':
      console.log('\nBlockers:');
      for (const err of state.errors || []) {
        console.log(`  - ${(err as { message?: string }).message || String(err)}`);
      }
      break;
    default:
      console.log('\nAction not implemented.');
  }
}

async function handleOpenRequest(runId: string, component: string, workspacePath: string): Promise<void> {
  const stateResult = await getRunState(runId, workspacePath);
  if (!stateResult) return;

  const requestPath = path.join(stateResult.runDir, 'components', component, 'execution-request.md');

  console.log(`\n📄 Execution request: ${requestPath}`);
  console.log(`\nWhen done, run:`);
  console.log(`  sea after-execution ${runId} -c ${component} -w ${workspacePath}`);

  const useEditor = process.env.EDITOR ? await confirm({ message: 'Open in $EDITOR?' }) : false;

  if (useEditor && process.env.EDITOR) {
    spawn(process.env.EDITOR, [requestPath], { stdio: 'inherit' });
  }
}

async function handleCaptureEvidence(runId: string, component: string, workspacePath: string): Promise<void> {
  console.log(`\n🔄 Capturing evidence for ${component}...`);

  try {
    await runSeaCommand(['after-execution', runId, '-c', component], workspacePath);
  } catch (e) {
    console.log('\n❌ Evidence capture failed.');
    return;
  }

  const stateResult = await getRunState(runId, workspacePath);
  if (stateResult) {
    const state = stateResult.state as unknown as WorkspaceState;
    const cs = state.componentStates[component];
    if (cs) {
      console.log(`\n✅ Evidence captured for ${component}`);
      console.log(`   Changed files: ${(cs.changedFiles as string[])?.length || 0}`);
      if (cs.diffPath) {
        console.log(`   Diff: ${cs.diffPath}`);
      }
    }
  }
}

async function handleRunVerification(runId: string, workspacePath: string): Promise<void> {
  console.log('\n🔄 Running verification...');

  try {
    await runSeaCommand(['verify', runId], workspacePath);
  } catch (e) {
    console.log('\n❌ Verification failed.');
    return;
  }

  console.log('\n✅ Verification complete.');
  console.log(`   Run \`sea status ${runId}\` to see results.`);
}

async function handleInspectArtifact(runId: string, component: string, workspacePath: string): Promise<void> {
  console.log(`\n🔄 Inspecting artifact for ${component}...`);

  try {
    await runSeaCommand(['inspect-artifact', runId, '-c', component], workspacePath);
  } catch (e) {
    console.log('\n❌ Artifact inspection failed.');
    return;
  }

  console.log('\n✅ Artifact inspection complete.');
}

async function handleResume(runId: string, workspacePath: string): Promise<void> {
  console.log('\n🔄 Resuming run...');

  try {
    await runSeaCommand(['resume', runId], workspacePath);
  } catch (e) {
    console.log('\n❌ Resume failed.');
    return;
  }

  console.log('\n✅ Run resumed. Run `sea report ' + runId + '` to see results.');
}

async function handleShowReport(state: WorkspaceState, workspacePath: string): Promise<void> {
  renderReport(state, workspacePath);
}

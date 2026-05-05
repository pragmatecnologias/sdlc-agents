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
import * as fs from 'fs/promises';
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
import { determineNextAction, NextAction, getMissingEvidence, formatNextActionCommand } from '../services/nextActionService.js';
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
  // Try to get the most recent active run and its next action
  let nextAction: NextAction | null = null;
  let recentRunId: string | null = null;

  try {
    const runs = await listRecentRuns(workspacePath, 5);
    const activeRuns = runs.filter(r =>
      r.runStatus !== 'completed' && r.runStatus !== 'failed' && r.runStatus !== 'aborted'
    );

    if (activeRuns.length > 0) {
      const latestRun = activeRuns[0];
      recentRunId = latestRun.runId;

      const stateResult = await getRunState(latestRun.runId, workspacePath);
      if (stateResult) {
        const state = stateResult.state as unknown as WorkspaceState;
        nextAction = determineNextAction(state);
      }
    }
  } catch {
    // Ignore — we'll just show the regular menu
  }

  const choices: Array<{ name: string; value: string }> = [];

  // One-button next action — only add if we have one
  if (nextAction && recentRunId) {
    const nextCmd = formatNextActionCommand(nextAction, workspacePath);
    choices.push({
      name: `▶  Recommended: ${nextAction.reason}${nextCmd ? ` (${nextCmd.split(' ').slice(0, 3).join(' ')})` : ''}`,
      value: `run-next`,
    });
  }

  choices.push(
    { name: 'Start new engineering run', value: 'start' },
    { name: 'Continue existing run', value: 'continue' },
    { name: 'View run status', value: 'status' },
    { name: 'Show next recommended action', value: 'next' },
    { name: 'Validate workspace', value: 'validate' },
    { name: 'Search memory', value: 'memory' },
    { name: 'Exit', value: 'exit' },
  );

  const answer = await select({
    message: nextAction
      ? `📋 Next Action: ${nextAction.reason}\n   Command: ${formatNextActionCommand(nextAction, workspacePath) || 'none'}\n\nWhat would you like to do?`
      : 'What would you like to do?',
    choices,
  });

  switch (answer) {
    case 'run-next':
      if (nextAction && recentRunId) {
        await handleRunNextAction(nextAction, recentRunId, workspacePath);
      }
      break;
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
// One-button Next Action
// ============================================================================

async function handleRunNextAction(
  nextAction: NextAction,
  runId: string,
  workspacePath: string
): Promise<void> {
  console.log(`\n▶  Running next action for ${runId}...\n`);

  const cmd = formatNextActionCommand(nextAction, workspacePath);

  if (!cmd) {
    console.log('No action needed — run may be complete.');
    return;
  }

  // Route to the appropriate handler based on action type
  switch (nextAction.type) {
    case 'OPEN_EXECUTION_REQUEST': {
      const component = nextAction.component || '';
      await handleOpenRequest(runId, component, workspacePath);
      break;
    }
    case 'CAPTURE_EVIDENCE': {
      const component = nextAction.component || '';
      await handleCaptureEvidence(runId, component, workspacePath);
      break;
    }
    case 'RUN_VERIFICATION': {
      await handleRunVerification(runId, workspacePath);
      break;
    }
    case 'INSPECT_ARTIFACT': {
      const component = nextAction.component || '';
      await handleInspectArtifact(runId, component, workspacePath);
      break;
    }
    case 'SHOW_REPORT': {
      const stateResult = await getRunState(runId, workspacePath);
      if (stateResult) {
        await handleShowReport(stateResult.state as unknown as WorkspaceState, workspacePath);
      }
      break;
    }
    case 'RESUME':
    case 'FIX_BLOCKER': {
      await handleResume(runId, workspacePath);
      break;
    }
    case 'NONE':
      console.log('No action needed — run may already be complete.');
      break;
    default:
      console.log(`Don't know how to handle action type: ${nextAction.type}`);
  }
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
      const nextCmd = formatNextActionCommand(nextAction, workspacePath);
      if (nextCmd) {
        console.log(`   ${nextCmd}`);
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

  // Read and display the execution request content
  let requestContent: string;
  try {
    requestContent = await fs.readFile(requestPath, 'utf-8');
  } catch {
    console.log(`\n❌ Execution request file not found at: ${requestPath}`);
    return;
  }

  printBanner(`Execution Request: ${component}`);
  console.log(`  Run: ${runId}`);
  console.log(`  File: ${requestPath}\n`);

  console.log(requestContent);

  printDivider();
  console.log(`\nWhen done, capture evidence with:`);
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
  const stateResult = await getRunState(runId, workspacePath);
  if (!stateResult) {
    console.log(`\n❌ Run ${runId} not found.`);
    return;
  }

  const state = stateResult.state as unknown as WorkspaceState;

  // Show preview of components and commands that will be verified
  const VERIFIABLE_ROLES = new Set(['modify', 'verify_only', 'package_only', 'artifact_verify']);
  const componentsToVerify = Object.entries(state.componentStates)
    .filter(([, cs]) => VERIFIABLE_ROLES.has(cs.changeRole));

  if (componentsToVerify.length === 0) {
    console.log('\n  No components require verification.');
    return;
  }

  console.log('\n--- Verification Preview ---\n');
  console.log(`Components to verify: ${componentsToVerify.length}\n`);

  for (const [name, cs] of componentsToVerify) {
    const component = state.workspace.components?.find(c => c.name === name);
    const commands = component?.commands;
    console.log(`  ${name}:`);
    if (commands) {
      if (commands.test) console.log(`    test:     ${commands.test}`);
      if (commands.build) console.log(`    build:    ${commands.build}`);
      if (commands.lint) console.log(`    lint:     ${commands.lint}`);
      if (commands.typecheck) console.log(`    typecheck: ${commands.typecheck}`);
      if (commands.e2e) console.log(`    e2e:      ${commands.e2e}`);
      if (commands.smoke) console.log(`    smoke:    ${commands.smoke}`);
    }
    console.log();
  }

  const proceed = await confirm({ message: 'Run verification now?' });
  if (!proceed) {
    console.log('  Verification cancelled.');
    return;
  }

  console.log('\n🔄 Running verification...');

  try {
    await runSeaCommand(['verify', runId], workspacePath);
  } catch (e) {
    console.log('\n❌ Verification failed.');
    return;
  }

  // Show summary after completion
  const postResult = await getRunState(runId, workspacePath);
  if (postResult) {
    const postState = postResult.state as unknown as WorkspaceState;
    if (postState.verification) {
      const v = postState.verification;
      console.log(`\n--- Verification Summary ---`);
      console.log(`  Overall:      ${v.overallStatus}`);
      console.log(`  Commands run: ${v.totalCommandsRun}`);
      console.log(`  Passed:       ${v.totalPassed}`);
      console.log(`  Failed:       ${v.totalFailed}`);

      for (const [compName, compResult] of Object.entries(v.componentResults)) {
        const icon = compResult.status === 'passed' ? '✅' : '❌';
        console.log(`  ${icon} ${compName}: ${compResult.commandsRun} run, ${compResult.commandsFailed} failed`);
      }

      // Show next action
      const nextAction = determineNextAction(postState);
      console.log(`\n  Next: ${nextAction.reason}`);
      const nextCmd = formatNextActionCommand(nextAction, workspacePath);
      if (nextCmd) {
        console.log(`  ${nextCmd}`);
      }
    }
  } else {
    console.log('\n✅ Verification complete.');
  }
}

async function handleInspectArtifact(runId: string, component: string, workspacePath: string): Promise<void> {
  const stateResult = await getRunState(runId, workspacePath);
  if (!stateResult) {
    console.log(`\n❌ Run ${runId} not found.`);
    return;
  }

  const state = stateResult.state as unknown as WorkspaceState;
  const componentConfig = state.workspace.components?.find(c => c.name === component);

  if (!componentConfig) {
    console.log(`\n❌ Component '${component}' not found in workspace.`);
    return;
  }

  if (!componentConfig.artifact || componentConfig.artifact.type === 'none') {
    console.log(`\n  Component '${component}' does not produce an artifact.`);
    return;
  }

  // Show inspection preview
  console.log('\n--- Artifact Inspection Preview ---\n');
  console.log(`  Component:      ${component}`);
  console.log(`  Artifact type:  ${componentConfig.artifact.type}`);
  if (componentConfig.artifact.outputPath) {
    console.log(`  Output path:    ${componentConfig.artifact.outputPath}`);
  }
  if (componentConfig.artifact.outputGlob) {
    console.log(`  Output glob:    ${componentConfig.artifact.outputGlob}`);
  }
  if (componentConfig.artifact.requiredEntries && componentConfig.artifact.requiredEntries.length > 0) {
    console.log(`  Required entries:`);
    for (const entry of componentConfig.artifact.requiredEntries) {
      console.log(`    - ${entry}`);
    }
  }
  console.log();

  const proceed = await confirm({ message: 'Run artifact inspection now?' });
  if (!proceed) {
    console.log('  Artifact inspection cancelled.');
    return;
  }

  console.log(`\n🔄 Inspecting artifact for ${component}...`);

  try {
    await runSeaCommand(['inspect-artifact', runId, '-c', component], workspacePath);
  } catch (e) {
    console.log('\n❌ Artifact inspection failed.');
    return;
  }

  // Show status after inspection
  const postResult = await getRunState(runId, workspacePath);
  if (postResult) {
    const postState = postResult.state as unknown as WorkspaceState;
    const cs = postState.componentStates[component];
    if (cs?.artifactInspection) {
      const ai = cs.artifactInspection as { status: string; artifactType: string };
      const icon = ai.status === 'passed' || ai.status === 'valid' ? '✅' : '❌';
      console.log(`\n  ${icon} Artifact inspection: ${ai.status} (${ai.artifactType})`);
    }
    const runDir = postResult.runDir;
    const reportPath = path.join(runDir, 'components', component, 'artifact-inspection.json');
    console.log(`  Report: ${reportPath}`);

    const nextAction = determineNextAction(postState);
    console.log(`\n  Next: ${nextAction.reason}`);
    const nextCmd = formatNextActionCommand(nextAction, workspacePath);
    if (nextCmd) {
      console.log(`  ${nextCmd}`);
    }
  } else {
    console.log('\n✅ Artifact inspection complete.');
  }
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

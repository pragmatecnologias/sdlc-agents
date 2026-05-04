/**
 * CLI Commands for SEA
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WorkspaceConfig,
  ComponentConfig,
  ComponentState,
  ExecutorResult,
  VerificationSummary,
  CommandResult,
  createDefaultApprovalPolicy,
  createDefaultQualityGates,
} from '../state/schemas.js';
import { WorkspaceState } from '../state/workspaceState.js';
import { createLogger } from '../utils/logger.js';
import { WorkflowRunner, createSeaWorkflowSteps } from '../workflow/runner.js';
import { loadState, saveState, saveComponentArtifact, getRunPaths } from '../workflow/checkpoint.js';
import { createSeaAgents } from '../agents/index.js';
import {
  captureSnapshot,
  getChangedFiles,
  saveGitDiffToFile,
  saveGitStatusToFile,
} from '../tools/gitTool.js';
import { validatePaths, PathPolicy } from '../tools/pathValidator.js';
import { runCommand } from '../tools/commandRunner.js';
import { resolveComponentPathFromState, getWorkspaceRoot, resolveSeaDir, resolveWorkspaceRoot, resolveRunBaseDir, resolveRunDir, resolveArtifactPath } from '../tools/resolvePath.js';

const logger = createLogger('CLI');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  program
    .name('sea')
    .description('SEA - Software Engineering Agents Control Plane')
    .version('0.1.0');

  // init command
  program
    .command('init')
    .description('Initialize a new SEA workspace')
    .requiredOption('-w, --workspace <name>', 'Workspace name')
    .option('-p, --path <path>', 'Workspace path', '.sea')
    .action(async (options) => {
      await handleInit(options.workspace, options.path);
    });

  // plan command
  program
    .command('plan')
    .description('Run planning phase only')
    .argument('<request>', 'The engineering request')
    .requiredOption('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (request, options) => {
      await handlePlan(request, options.workspace);
    });

  // run command
  program
    .command('run')
    .description('Run the full workflow')
    .argument('<request>', 'The engineering request')
    .requiredOption('-w, --workspace <path>', 'Path to workspace.json')
    .option('--executor <name>', 'Executor to use', 'manual')
    .option('--no-approval', 'Skip human approval gate')
    .action(async (request, options) => {
      await handleRun(request, options.workspace, {
        executor: options.executor,
        skipApproval: options.noApproval,
      });
    });

  // request command
  program
    .command('request')
    .description('Show execution request for a component')
    .argument('<runId>', 'Run ID')
    .requiredOption('-c, --component <name>', 'Component name')
    .option('-o, --output <path>', 'Output file')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleRequest(runId, options.component, options.output, options.workspace);
    });

  // after-execution command
  program
    .command('after-execution')
    .description('Capture evidence after manual execution')
    .argument('<runId>', 'Run ID')
    .requiredOption('-c, --component <name>', 'Component name')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleAfterExecution(runId, options.component, options.workspace);
    });

  // verify command
  program
    .command('verify')
    .description('Run verification for affected components')
    .argument('<runId>', 'Run ID')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleVerify(runId, options.workspace);
    });

  // inspect-artifact command
  program
    .command('inspect-artifact')
    .description('Inspect component artifact (JAR, WAR, npm package, etc.)')
    .argument('<runId>', 'Run ID')
    .requiredOption('-c, --component <name>', 'Component name')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleInspectArtifact(runId, options.component, options.workspace);
    });

  // resume command
  program
    .command('resume')
    .description('Resume from latest checkpoint')
    .argument('<runId>', 'Run ID')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleResume(runId, options.workspace);
    });

  // report command
  program
    .command('report')
    .description('Show final report for a run')
    .argument('<runId>', 'Run ID')
    .option('-w, --workspace <path>', 'Path to workspace.json')
    .action(async (runId, options) => {
      await handleReport(runId, options.workspace);
    });

  // memory command
  program
    .command('memory')
    .description('Search or show memory')
    .argument('[query]', 'Search query')
    .action(async (query) => {
      await handleMemory(query);
    });
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

async function handleInit(workspaceName: string, seaPath: string): Promise<void> {
  logger.info(`Initializing workspace: ${workspaceName}`);

  const sampleComponents: ComponentConfig[] = [
    {
      name: 'example-frontend',
      path: './packages/frontend',
      kind: 'frontend',
      role: 'application',
      technology: 'typescript',
      framework: 'react',
      packageManager: 'npm',
      commands: {
        install: 'npm install',
        lint: 'npm run lint',
        typecheck: 'npm run typecheck',
        test: 'npm test',
        build: 'npm run build',
      },
      dependencies: ['example-shared'],
      protectedPaths: ['**/config/**'],
      forbiddenPaths: ['**/.env*'],
    },
  ];

  const workspaceConfig: WorkspaceConfig = {
    workspaceName,
    defaultExecutor: 'manual',
    approvalPolicy: createDefaultApprovalPolicy(),
    qualityGates: createDefaultQualityGates(),
    components: sampleComponents,
    memory: {
      enabled: true,
      path: path.join(seaPath, 'engineering_memory.md'),
    },
    artifacts: {
      rootDir: path.join(seaPath, 'runs'),
    },
  };

  // Create .sea directory
  await fs.mkdir(seaPath, { recursive: true });

  // Write workspace.json
  const configPath = path.join(seaPath, 'workspace.json');
  await fs.writeFile(configPath, JSON.stringify(workspaceConfig, null, 2), 'utf-8');

  // Create engineering_memory.md
  const memoryPath = path.join(seaPath, 'engineering_memory.md');
  await fs.writeFile(
    memoryPath,
    `# Engineering Memory Log\n\nThis file stores past engineering decisions for future reference.\n`,
    'utf-8'
  );

  console.log(`Workspace initialized at ${seaPath}`);
  console.log(`  - workspace.json created`);
  console.log(`  - engineering_memory.md created`);
  console.log(`  - ${sampleComponents.length} sample component(s) configured`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review and configure components in ${configPath}`);
  console.log(`  2. Run: sea plan "<request>" --workspace ${configPath}`);
  console.log(`  3. Or run the full workflow: sea run "<request>" --workspace ${configPath}`);
}

// ---------------------------------------------------------------------------
// plan
// ---------------------------------------------------------------------------

async function handlePlan(request: string, workspacePath: string): Promise<void> {
  logger.info(`Running plan for: ${request}`);

  try {
    // Load workspace config
    const configContent = await fs.readFile(workspacePath, 'utf-8');
    const workspaceConfig = JSON.parse(configContent) as WorkspaceConfig;

    // Generate run ID
    const runId = `run-${Date.now()}`;

    // Get actual workspace path (parent of .sea directory)
    const baseDir = resolveWorkspaceRoot(workspacePath);

    // Fix workspaceConfig to use actual path as workspaceName
    const workspaceConfigForRun = {
      ...workspaceConfig,
      workspaceName: baseDir,
    };

    // Create agents
    const agents = createSeaAgents({
      memoryPath: workspaceConfig.memory?.path || path.join(resolveSeaDir(workspacePath), 'engineering_memory.md'),
    });

    // Create workflow steps (planning phases only)
    const allSteps = createSeaWorkflowSteps(agents);
    const planningSteps = allSteps.filter((step) => {
      if (!('id' in step) || !step.id) return false;
      const planningIds = [
        'memory-retrieval',
        'requirement-intake',
        'workspace-discovery',
        'profile-detection',
        'component-mapping',
        'impact-analysis',
        'architecture-planning',
        'implementation-planning',
      ];
      return planningIds.includes(step.id);
    });

    // Create workflow runner
    const seaDir = resolveSeaDir(workspacePath);
    const runner = new WorkflowRunner({
      baseDir: seaDir,
      onPhaseComplete: (phase) => {
        console.log(`  [done] ${phase} completed`);
      },
    });

    console.log(`Starting planning run: ${runId}`);
    console.log(`Request: ${request}\n`);

    // Run planning only
    const result = await runner.run(runId, request, workspaceConfigForRun, planningSteps);

    if (result.success) {
      console.log(`\nPlanning completed successfully`);
      console.log(`  Run ID: ${runId}`);
      console.log(`  Phases: ${result.completedPhases.join(' -> ')}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Review the plan in ${seaDir}/runs/${runId}/state.json`);
      console.log(`  2. Execute components: sea request ${runId} -c <component>`);
      console.log(`  3. After execution: sea after-execution ${runId} -c <component>`);
      console.log(`  4. Verify: sea verify ${runId}`);
    } else {
      console.log(`\nPlanning failed: ${result.error}`);
    }
  } catch (error) {
    logger.error(`Planning failed: ${error}`);
    console.error(`Error: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function handleRun(
  request: string,
  workspacePath: string,
  options: { executor?: string; skipApproval?: boolean }
): Promise<void> {
  logger.info(`Running: ${request}`);

  try {
    // Load workspace config
    const configContent = await fs.readFile(workspacePath, 'utf-8');
    const workspaceConfig = JSON.parse(configContent) as WorkspaceConfig;

    // Generate run ID
    const runId = `run-${Date.now()}`;

    // Get actual workspace path (parent of .sea directory)
    const baseDir = resolveWorkspaceRoot(workspacePath);
    const seaDir = resolveSeaDir(workspacePath);

    // Fix workspaceConfig to use actual path as workspaceName
    const workspaceConfigForRun = {
      ...workspaceConfig,
      workspaceName: baseDir,
    };

    // Create agents
    const agents = createSeaAgents({
      memoryPath: workspaceConfig.memory?.path || path.join(seaDir, 'engineering_memory.md'),
    });

    // Create workflow steps
    const steps = createSeaWorkflowSteps(agents);

    // Create workflow runner
    const runner = new WorkflowRunner({
      baseDir: seaDir,
      onPhaseComplete: (phase, state) => {
        console.log(`  [done] ${phase} completed`);
      },
      onHumanApproval: async () => {
        if (options.skipApproval) {
          return true;
        }
        // For now, auto-approve in CLI mode
        // TODO: Implement interactive approval prompt
        return true;
      },
    });

    console.log(`Starting workflow run: ${runId}`);
    console.log(`Request: ${request}`);

    // Run the workflow
    const result = await runner.run(runId, request, workspaceConfigForRun, steps);

    if (result.success) {
      const state = result.state as WorkspaceState;
      console.log(`\nWorkflow completed successfully`);
      console.log(`  Run ID: ${runId}`);
      console.log(`  Phases completed: ${result.completedPhases.join(', ')}`);

      // If executor is manual, guide the user to the next steps
      if (options.executor === 'manual' || workspaceConfig.defaultExecutor === 'manual') {
        if (state.runStatus === 'awaiting_manual_execution' || state.componentStates) {
          const componentsToExecute = Object.entries(state.componentStates || {})
            .filter(([, cs]) => cs.executionRequestPath && cs.executorResult?.status === 'manual_required')
            .map(([name]) => name);

          if (componentsToExecute.length > 0) {
            console.log(`\n--- Manual Execution Required ---`);
            console.log(`The following components need manual execution:\n`);
            for (const comp of componentsToExecute) {
              console.log(`  ${comp}:`);
              console.log(`    1. View execution request:  sea request ${runId} -c ${comp}`);
              console.log(`    2. Execute the changes in your editor / executor`);
              console.log(`    3. Capture evidence:        sea after-execution ${runId} -c ${comp}`);
              console.log();
            }
            console.log(`After all components are done:`);
            console.log(`  sea verify ${runId}`);
            console.log(`  sea report ${runId}`);
          } else {
            console.log(`\nNo components require manual execution.`);
            console.log(`Run: sea verify ${runId}`);
          }
        }
      }
    } else {
      console.log(`\nWorkflow failed: ${result.error}`);
      console.log(`  Completed phases: ${result.completedPhases.join(', ')}`);
    }
  } catch (error) {
    logger.error(`Workflow failed: ${error}`);
    console.error(`Error: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// request
// ---------------------------------------------------------------------------

async function handleRequest(runId: string, component: string, output?: string, workspacePath?: string): Promise<void> {
  logger.info(`Showing request for ${component} in run ${runId}`);

  const baseDir = workspacePath ? resolveSeaDir(workspacePath) : '.sea';
  let state: WorkspaceState;
  try {
    state = await loadState(runId, baseDir);
  } catch {
    console.error(`Run ${runId} not found in ${baseDir}.`);
    process.exit(1);
  }

  // Find component state
  const componentState = state.componentStates[component];
  if (!componentState) {
    const available = Object.keys(state.componentStates).join(', ');
    console.error(`Component "${component}" not found in run ${runId}.`);
    console.error(`Available components: ${available || '(none)'}`);
    process.exit(1);
  }

  // Check for execution request path
  if (!componentState.executionRequestPath) {
    console.error(`No execution request found for component "${component}".`);
    console.error(`The component may not have been planned for execution yet.`);
    process.exit(1);
  }

  // Resolve execution request path relative to the runs directory
  const runPaths = getRunPaths(runId, baseDir);
  const requestFilePath = path.resolve(runPaths.runDir, componentState.executionRequestPath);

  let requestContent: string;
  try {
    requestContent = await fs.readFile(requestFilePath, 'utf-8');
  } catch {
    console.error(`Execution request file not found at: ${requestFilePath}`);
    process.exit(1);
  }

  // Print to console
  console.log(`=== Execution Request: ${component} ===`);
  console.log(`Run: ${runId}`);
  console.log(`Path: ${componentState.componentPath}`);
  console.log(`Change Role: ${componentState.changeRole}`);
  console.log(`=====================================\n`);
  console.log(requestContent);

  // Write to output file if specified
  if (output) {
    await fs.writeFile(output, requestContent, 'utf-8');
    console.log(`\nExecution request written to: ${output}`);
  }
}

// ---------------------------------------------------------------------------
// after-execution
// ---------------------------------------------------------------------------

async function handleAfterExecution(runId: string, component: string, workspacePath?: string): Promise<void> {
  logger.info(`Capturing evidence for ${component} in run ${runId}`);

  // Load state
  const baseDir = workspacePath ? resolveSeaDir(workspacePath) : '.sea';
  let state: WorkspaceState;
  try {
    state = await loadState(runId, baseDir);
  } catch {
    console.error(`Run ${runId} not found. Checked: ${baseDir}`);
    process.exit(1);
  }

  // Find component config from workspace.components
  const componentConfig = state.workspace.components.find((c: ComponentConfig) => c.name === component);
  if (!componentConfig) {
    const available = state.workspace.components.map((c: ComponentConfig) => c.name).join(', ');
    console.error(`Component "${component}" not found in workspace configuration.`);
    console.error(`Available components: ${available || '(none)'}`);
    process.exit(1);
  }

  // Find or create component state (after-execution works even for components not in the original plan)
  let componentState = state.componentStates[component];
  if (!componentState) {
    console.log(`  Component "${component}" has no prior state - creating minimal state`);
    componentState = {
      componentName: component,
      componentPath: componentConfig.path,
      kind: componentConfig.kind,
      role: componentConfig.role,
      changeRole: 'modify' as const,
      branchBefore: null,
      branchCreated: null,
      dirtyBefore: false,
      dirtyAfter: false,
      analysis: null,
      plan: null,
      executionRequestPath: null,
      executorResult: null,
      gitStatusBeforePath: null,
      gitStatusAfterPath: null,
      changedFiles: [],
      forbiddenPathViolations: [],
      protectedPathViolations: [],
      diffPath: null,
      commandResults: [],
      artifactInspection: null,
      fixAttempts: [],
      componentDecision: 'pending' as const,
    };
    state.componentStates[component] = componentState;
  }

  // Resolve component path using centralized resolver
  const componentPath = resolveComponentPathFromState(state, componentConfig);

  const runPaths = getRunPaths(runId, baseDir);
  const componentDir = path.join(runPaths.componentsDir, component);
  await fs.mkdir(componentDir, { recursive: true });

  // 1. Capture snapshot (BEFORE state) or use saved gitStatusBeforePath
  console.log(`\nCapturing evidence for component: ${component}`);
  console.log(`  Component path: ${componentPath}`);

  let beforeSnapshot;
  if (componentState.gitStatusBeforePath) {
    const beforePath = path.resolve(runPaths.runDir, componentState.gitStatusBeforePath);
    try {
      const beforeContent = await fs.readFile(beforePath, 'utf-8');
      beforeSnapshot = JSON.parse(beforeContent);
      console.log(`  Loaded saved BEFORE state from: ${componentState.gitStatusBeforePath}`);
    } catch {
      console.log(`  Could not load saved BEFORE state, capturing fresh snapshot`);
      beforeSnapshot = await captureSnapshot(componentPath);
    }
  } else {
    beforeSnapshot = await captureSnapshot(componentPath);
    console.log(`  Captured fresh snapshot as BEFORE state`);
  }

  // 2. Get changed files
  const changedFiles = await getChangedFiles(componentPath);
  console.log(`  Changed files: ${changedFiles.length}`);

  if (changedFiles.length > 0) {
    console.log(`    ${changedFiles.map((f) => `  - ${f}`).join('\n')}`);
  }

  // 3. Save diff
  const diffPath = path.join(componentDir, 'diff.patch');
  await saveGitDiffToFile(componentPath, diffPath);
  console.log(`  Diff saved to: ${diffPath}`);

  // 4. Save git status (AFTER)
  const statusPath = path.join(componentDir, 'git-status-after.json');
  await saveGitStatusToFile(componentPath, statusPath);
  console.log(`  Git status saved to: ${statusPath}`);

  // 5. Validate paths
  // allowedPaths comes from the component plan, not from protectedPaths
  const planAllowedPaths = componentState.plan?.allowedPaths || [];
  const planProtectedPaths = componentState.plan?.protectedPaths || [];
  const planForbiddenPaths = componentState.plan?.forbiddenPaths || [];

  const pathPolicy: PathPolicy = {
    allowedPaths: planAllowedPaths.length > 0
      ? planAllowedPaths
      : ['**/*'],
    protectedPaths: [
      ...planProtectedPaths,
      ...(componentConfig.protectedPaths || []),
      ...(state.workspace.globalProtectedPaths || []),
    ],
    forbiddenPaths: [
      ...planForbiddenPaths,
      ...(componentConfig.forbiddenPaths || []),
    ],
  };

  const validation = validatePaths(changedFiles, pathPolicy);

  // 6. Build executor result
  const now = new Date().toISOString();
  const executorResult: ExecutorResult = {
    executor: 'manual',
    status: changedFiles.length > 0 ? 'completed' : 'completed',
    changedFiles,
    diffPath: path.relative(runPaths.runDir, diffPath),
    startedAt: componentState.executorResult?.startedAt || now,
    finishedAt: now,
    notes: [
      `Captured ${changedFiles.length} changed files`,
      validation.status !== 'clean'
        ? `Path validation status: ${validation.status}`
        : 'Path validation: clean',
    ],
  };

  // 7. Update component state
  const updatedComponentState: ComponentState = {
    ...componentState,
    changedFiles,
    diffPath: path.relative(runPaths.runDir, diffPath),
    gitStatusAfterPath: path.relative(runPaths.runDir, statusPath),
    forbiddenPathViolations: validation.forbiddenViolations,
    protectedPathViolations: validation.protectedViolations,
    executorResult,
    dirtyAfter: changedFiles.length > 0,
    componentDecision: changedFiles.length > 0 ? 'implemented' : componentState.componentDecision,
  };

  state.componentStates[component] = updatedComponentState;

  // Save updated state
  await saveState(state, baseDir);

  // Print summary
  console.log(`\n--- Evidence Capture Summary ---`);
  console.log(`  Component:   ${component}`);
  console.log(`  Run:         ${runId}`);
  console.log(`  Changed:     ${changedFiles.length} file(s)`);
  console.log(`  Dirty after: ${updatedComponentState.dirtyAfter}`);
  console.log(`  Decision:    ${updatedComponentState.componentDecision}`);
  console.log(`  Validation:  ${validation.status}`);

  if (validation.forbiddenViolations.length > 0) {
    console.log(`\n  FORBIDDEN path violations:`);
    for (const f of validation.forbiddenViolations) {
      console.log(`    - ${f}`);
    }
  }

  if (validation.protectedViolations.length > 0) {
    console.log(`\n  PROTECTED path violations:`);
    for (const p of validation.protectedViolations) {
      console.log(`    - ${p}`);
    }
  }

  console.log(`\nArtifacts saved to: ${componentDir}`);
  console.log(`  - diff.patch`);
  console.log(`  - git-status-after.json`);
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

async function handleVerify(runId: string, workspacePath?: string): Promise<void> {
  logger.info(`Verifying run ${runId}`);

  const baseDir = workspacePath ? resolveSeaDir(workspacePath) : '.sea';
  let state: WorkspaceState;
  try {
    state = await loadState(runId, baseDir);
  } catch {
    console.error(`Run ${runId} not found. Checked: ${baseDir}`);
    process.exit(1);
  }

  // Find components that need verification
  const componentsToVerify = Object.entries(state.componentStates)
    .filter(([, cs]) => cs.changeRole === 'modify' || cs.changeRole === 'verify_only');

  if (componentsToVerify.length === 0) {
    console.log(`No components require verification for run ${runId}.`);
    return;
  }

  console.log(`Verifying ${componentsToVerify.length} component(s) for run ${runId}\n`);

  // Use the same verification agent as the workflow
  const agents = createSeaAgents({
    memoryPath: state.workspace.memory?.path || path.join(baseDir, 'engineering_memory.md'),
  });

  const result = await agents.verificationAgent(state);

  // Merge result into state
  if (result.verification) {
    state.verification = result.verification;
  }
  if (result.componentStates) {
    state.componentStates = { ...state.componentStates, ...result.componentStates };
  }
  await saveState(state, baseDir);

  const summary = state.verification!;

  // Print verification results per component
  for (const [componentName, compResult] of Object.entries(summary.componentResults)) {
    console.log(`--- ${componentName}: ${compResult.status} ---`);
    console.log(`  Commands: ${compResult.commandsRun} run, ${compResult.commandsPassed} passed, ${compResult.commandsFailed} failed`);
  }

  // Print verification summary
  console.log(`\n=== Verification Summary ===`);
  console.log(`  Overall:      ${summary.overallStatus}`);
  console.log(`  Commands run: ${summary.totalCommandsRun}`);
  console.log(`  Passed:       ${summary.totalPassed}`);
  console.log(`  Failed:       ${summary.totalFailed}`);
  console.log(`  Tests run:    ${summary.testsRun ? 'yes' : 'no'}`);
  console.log(`  Builds run:   ${summary.buildsRun ? 'yes' : 'no'}`);

  if (summary.totalFailed > 0) {
    console.log(`\nComponents with failures:`);
    for (const [name, result] of Object.entries(summary.componentResults)) {
      if (result.status === 'failed') {
        console.log(`  - ${name}: ${result.commandsFailed}/${result.commandsRun} failed`);
      }
    }
  }

  if (summary.overallStatus === 'passed') {
    console.log(`\nNext: sea report ${runId}`);
  }
}

// ---------------------------------------------------------------------------
// inspect-artifact
// ---------------------------------------------------------------------------

async function handleInspectArtifact(
  runId: string,
  componentName: string,
  workspacePath?: string
): Promise<void> {
  logger.info(`Inspecting artifact for component ${componentName} in run ${runId}`);

  const baseDir = workspacePath ? resolveSeaDir(workspacePath) : '.sea';
  let state: WorkspaceState;
  try {
    state = await loadState(runId, baseDir);
  } catch {
    console.error(`Run ${runId} not found. Checked: ${baseDir}`);
    process.exit(1);
  }

  // Find the component config
  const componentConfig = state.workspace.components.find(c => c.name === componentName);
  if (!componentConfig) {
    console.error(`Component '${componentName}' not found in workspace`);
    process.exit(1);
  }

  if (!componentConfig.artifact || componentConfig.artifact.type === 'none') {
    console.error(`Component '${componentName}' does not produce an artifact`);
    process.exit(1);
  }

  // Resolve component path and artifact path
  const componentPath = resolveComponentPathFromState(state, componentConfig);
  const artifactPath = resolveArtifactPath(componentPath, componentConfig.artifact.outputPath);

  // Check if artifact exists
  let artifactExists = false;
  try {
    await fs.access(artifactPath);
    artifactExists = true;
  } catch {
    // try as directory (for built artifacts)
    try {
      const stat = await fs.stat(artifactPath);
      artifactExists = stat.isFile();
    } catch {
      artifactExists = false;
    }
  }

  if (!artifactExists) {
    console.error(`Artifact not found: ${artifactPath}`);
    console.error(`Run 'sea run ...' to build the artifact first, or use manual executor to build`);
    process.exit(1);
  }

  console.log(`Inspecting artifact: ${artifactPath}`);

  // Use artifact inspection agent
  const agents = createSeaAgents({
    memoryPath: state.workspace.memory?.path || path.join(baseDir, 'engineering_memory.md'),
  });

  // Run artifact inspection
  const result = await agents.artifactInspectionAgent(state);

  // Merge result into state
  if (result.artifactInspections) {
    state.artifactInspections = result.artifactInspections;
  }
  if (result.componentStates) {
    state.componentStates = { ...state.componentStates, ...result.componentStates };
  }
  await saveState(state, baseDir);

  // Find the inspection for this component
  const inspection = state.artifactInspections.find(
    (ai: any) => ai.component === componentName
  );

  if (!inspection) {
    console.error(`No artifact inspection result for component '${componentName}'`);
    process.exit(1);
  }

  // Print inspection result
  console.log(`\n=== Artifact Inspection: ${componentName} ===`);
  console.log(`  Artifact:   ${inspection.artifactPath}`);
  console.log(`  Type:      ${inspection.artifactType}`);
  console.log(`  Status:    ${inspection.status}`);
  console.log(`  Exists:    ${inspection.exists ? 'yes' : 'no'}`);
  console.log(`  Readable:  ${inspection.readable ? 'yes' : 'no'}`);

  if (Object.keys(inspection.entriesChecked || {}).length > 0) {
    console.log(`\n  Entries checked:`);
    for (const [entry, present] of Object.entries(inspection.entriesChecked)) {
      console.log(`    ${entry}: ${present ? '✓' : '✗'}`);
    }
  }

  if (inspection.errors && inspection.errors.length > 0) {
    console.log(`\n  Errors:`);
    for (const err of inspection.errors) {
      console.log(`    - ${err}`);
    }
  }

  if (inspection.warnings && inspection.warnings.length > 0) {
    console.log(`\n  Warnings:`);
    for (const warn of inspection.warnings) {
      console.log(`    - ${warn}`);
    }
  }

  // Save inspection report to component directory
  const componentState = state.componentStates[componentName];
  if (componentState) {
    const runPaths = {
      runDir: path.join(baseDir, 'runs', runId),
      componentsDir: path.join(baseDir, 'runs', runId, 'components'),
    };
    const componentDir = path.join(runPaths.componentsDir, componentName);
    const reportPath = path.join(componentDir, 'artifact-inspection.json');
    await fs.writeFile(reportPath, JSON.stringify(inspection, null, 2), 'utf-8');
    console.log(`\n  Report saved to: ${reportPath}`);
  }

  console.log(`\nNext: sea report ${runId}`);
}

// ---------------------------------------------------------------------------
// resume
// ---------------------------------------------------------------------------

async function handleResume(runId: string, workspacePath?: string): Promise<void> {
  logger.info(`Resuming run ${runId}`);

  let baseDir: string | undefined;

  if (workspacePath) {
    baseDir = resolveSeaDir(workspacePath);
  } else {
    // Try to find the run by looking in common locations
    const candidates = ['.sea'];
    for (const candidate of candidates) {
      try {
        await loadState(runId, candidate);
        baseDir = candidate;
        break;
      } catch {
        continue;
      }
    }
  }

  if (!baseDir) {
    console.error(`Run ${runId} not found. Use -w to specify workspace path.`);
    process.exit(1);
  }

  // Load state to get workspace config and memory path
  const state = await loadState(runId, baseDir).catch(() => {
    console.error(`Run ${runId} not found in ${baseDir}.`);
    process.exit(1);
  });

  const memoryPath = state.workspace.memory?.path || path.join(baseDir, 'engineering_memory.md');

  // Create agents and steps
  const agents = createSeaAgents({ memoryPath });
  const steps = createSeaWorkflowSteps(agents);

  // Create runner and resume
  const runner = new WorkflowRunner({
    baseDir,
    onPhaseComplete: (phase) => {
      console.log(`  [done] ${phase} completed`);
    },
  });

  console.log(`Resuming run: ${runId}`);
  console.log(`  Base dir: ${baseDir}`);
  console.log(`  Current phase: ${state.currentPhase || 'unknown'}\n`);

  const result = await runner.resume(runId, steps);

  if (result.success) {
    console.log(`\nResume completed successfully`);
    console.log(`  Completed phases: ${result.completedPhases.join(' -> ')}`);
  } else {
    console.log(`\nResume failed: ${result.error}`);
  }
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

async function handleReport(runId: string, workspacePath?: string): Promise<void> {
  logger.info(`Showing report for run ${runId}`);

  try {
    const baseDir = workspacePath ? resolveSeaDir(workspacePath) : '.sea';
    const statePath = path.join(baseDir, 'runs', runId, 'state.json');

    const stateContent = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(stateContent) as WorkspaceState;

    const runPaths = getRunPaths(runId, baseDir);

    console.log(`\n=========================================`);
    console.log(`  SEA Run Report: ${runId}`);
    console.log(`=========================================\n`);

    // Run status and request
    console.log(`Status:     ${state.runStatus || 'unknown'}`);
    console.log(`Request:    ${state.userRequest || '(none)'}`);
    console.log(`Created:    ${state.createdAt || '(unknown)'}`);
    console.log(`Updated:    ${state.updatedAt || '(unknown)'}`);

    // Component statuses
    if (state.componentStates && Object.keys(state.componentStates).length > 0) {
      console.log(`\n--- Components ---`);
      for (const [name, cs] of Object.entries(state.componentStates)) {
        const changedCount = cs.changedFiles?.length || 0;
        const violations = (cs.forbiddenPathViolations?.length || 0) + (cs.protectedPathViolations?.length || 0);
        const cmdResults = cs.commandResults?.length || 0;
        const passedCmds = cs.commandResults?.filter((r: any) => r.status === 'passed').length || 0;

        console.log(`  ${name}:`);
        console.log(`    Decision:   ${cs.componentDecision}`);
        console.log(`    Change:     ${cs.changeRole}`);
        console.log(`    Files:      ${changedCount} changed`);
        if (violations > 0) {
          console.log(`    Violations: ${violations} (forbidden: ${cs.forbiddenPathViolations?.length || 0}, protected: ${cs.protectedPathViolations?.length || 0})`);
        }
        if (cmdResults > 0) {
          console.log(`    Commands:   ${passedCmds}/${cmdResults} passed`);
        }
        if (cs.diffPath) {
          console.log(`    Diff:       ${path.join(runPaths.runDir, cs.diffPath)}`);
        }
        if (cs.executionRequestPath) {
          console.log(`    Request:    ${path.join(runPaths.runDir, cs.executionRequestPath)}`);
        }
      }
    }

    // Verification
    if (state.verification) {
      const v = state.verification;
      console.log(`\n--- Verification ---`);
      console.log(`  Overall:      ${v.overallStatus}`);
      console.log(`  Commands run: ${v.totalCommandsRun}`);
      console.log(`  Passed:       ${v.totalPassed}`);
      console.log(`  Failed:       ${v.totalFailed}`);
      console.log(`  Tests run:    ${v.testsRun ? 'yes' : 'no'}`);
      console.log(`  Builds run:   ${v.buildsRun ? 'yes' : 'no'}`);

      if (v.totalFailed > 0) {
        console.log(`\n  Failed components:`);
        for (const [name, result] of Object.entries(v.componentResults)) {
          if (result.status === 'failed') {
            console.log(`    - ${name}: ${result.commandsFailed}/${result.commandsRun} failed`);
          }
        }
      }
    }

    // Brutal Reality Check
    if (state.brutalRealityCheck) {
      const brc = state.brutalRealityCheck;
      console.log(`\n--- Brutal Reality Check ---`);
      console.log(`  Score: ${brc.score}/100`);
      console.log(`  Verdict: ${brc.verdict}`);
      if (brc.real?.length) {
        console.log(`  REAL:`);
        brc.real.forEach((item: string) => console.log(`    - ${item}`));
      }
      if (brc.partial?.length) {
        console.log(`  PARTIAL:`);
        brc.partial.forEach((item: string) => console.log(`    - ${item}`));
      }
      if (brc.fakeOrUnverified?.length) {
        console.log(`  FAKE_OR_UNVERIFIED:`);
        brc.fakeOrUnverified.forEach((item: string) => console.log(`    - ${item}`));
      }
      if (brc.missing?.length) {
        console.log(`  MISSING:`);
        brc.missing.forEach((item: string) => console.log(`    - ${item}`));
      }
    }

    // Final Decision
    if (state.finalDecision) {
      const fd = state.finalDecision;
      console.log(`\n--- Final Decision ---`);
      console.log(`  Decision: ${fd.decision}`);
      console.log(`  Summary:  ${fd.summary}`);
      if (fd.requiredFixes?.length) {
        console.log(`\n  Required fixes:`);
        fd.requiredFixes.forEach((fix: string) => console.log(`    - ${fix}`));
      }
      if (fd.warnings?.length) {
        console.log(`\n  Warnings:`);
        fd.warnings.forEach((w: string) => console.log(`    - ${w}`));
      }
    }

    // Artifact Inspections
    if (state.artifactInspections?.length) {
      console.log(`\n--- Artifact Inspections ---`);
      for (const ai of state.artifactInspections) {
        console.log(`  ${ai.component}: ${ai.artifactType} - ${ai.status}`);
        if (ai.errors?.length) {
          ai.errors.forEach((e: string) => console.log(`    ERROR: ${e}`));
        }
        if (ai.warnings?.length) {
          ai.warnings.forEach((w: string) => console.log(`    WARN: ${w}`));
        }
      }
    }

    // Missing evidence
    const missing: string[] = [];
    if (!state.verification) missing.push('verification not run');
    if (!state.brutalRealityCheck) missing.push('brutal reality check not run');
    if (!state.finalDecision) missing.push('final decision not made');
    if (state.componentStates) {
      for (const [name, cs] of Object.entries(state.componentStates)) {
        if (cs.changeRole === 'modify' && cs.changedFiles.length === 0) {
          missing.push(`${name}: marked as modify but no files changed`);
        }
      }
    }
    if (missing.length > 0) {
      console.log(`\n--- Missing Evidence ---`);
      missing.forEach(m => console.log(`  - ${m}`));
    }

    // Next action
    console.log(`\n--- Next Action ---`);
    if (state.runStatus === 'awaiting_manual_execution') {
      console.log(`  Run: sea after-execution ${runId} -c <component> -w ${workspacePath || '.sea/workspace.json'}`);
    } else if (state.finalDecision?.decision === 'NEEDS_FIXES') {
      console.log(`  Review required fixes above, make changes, then re-run verification.`);
      console.log(`  Run: sea verify ${runId} -w ${workspacePath || '.sea/workspace.json'}`);
    } else if (state.finalDecision?.decision === 'BLOCKED') {
      console.log(`  Resolve blockers listed above.`);
    } else if (!state.verification) {
      console.log(`  Run: sea verify ${runId} -w ${workspacePath || '.sea/workspace.json'}`);
    } else {
      console.log(`  Run complete. Review results above.`);
    }

    console.log(`\n=========================================\n`);
  } catch (error) {
    logger.error(`Report failed: ${error}`);
    console.error(`Error: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------

async function handleMemory(query?: string): Promise<void> {
  // Default memory path
  let memoryPath = '.sea/engineering_memory.md';

  // Try to load workspace.json to get configured memory path
  const possibleWorkspacePaths = ['.sea/workspace.json'];
  for (const wp of possibleWorkspacePaths) {
    try {
      const content = await fs.readFile(wp, 'utf-8');
      const config = JSON.parse(content) as WorkspaceConfig;
      if (config.memory?.path) {
        memoryPath = config.memory.path;
        break;
      }
    } catch {
      continue;
    }
  }

  let content: string;
  try {
    content = await fs.readFile(memoryPath, 'utf-8');
  } catch {
    console.error(`Memory file not found at: ${memoryPath}`);
    console.error(`Initialize a workspace first: sea init --workspace <name>`);
    process.exit(1);
  }

  if (query) {
    // Search for matching lines (case-insensitive)
    const queryLower = query.toLowerCase();
    const lines = content.split('\n');
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        // Include context: previous line and next line if they exist
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const contextLines = lines.slice(start, end);
        matches.push(contextLines.join('\n'));
      }
    }

    if (matches.length === 0) {
      console.log(`No entries found matching: "${query}"`);
    } else {
      console.log(`Found ${matches.length} match(es) for "${query}":\n`);
      // Deduplicate overlapping context windows
      const seen = new Set<string>();
      for (const match of matches) {
        if (!seen.has(match)) {
          seen.add(match);
          console.log(match);
          console.log('---');
        }
      }
    }
  } else {
    // Show all entries (tail last 50 lines if large)
    const lines = content.split('\n');
    if (lines.length > 50) {
      console.log(`Showing last 50 of ${lines.length} lines:\n`);
      const tail = lines.slice(-50);
      console.log(tail.join('\n'));
    } else {
      console.log(content);
    }
  }
}

/**
 * CLI Commands for SEA
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createDefaultApprovalPolicy, createDefaultQualityGates, } from '../state/schemas.js';
import { createLogger } from '../utils/logger.js';
import { WorkflowRunner, createSeaWorkflowSteps } from '../workflow/runner.js';
import { createSeaAgents } from '../agents/index.js';
const logger = createLogger('CLI');
/**
 * Register all CLI commands
 */
export function registerCommands(program) {
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
        .action(async (runId, options) => {
        await handleRequest(runId, options.component, options.output);
    });
    // after-execution command
    program
        .command('after-execution')
        .description('Capture evidence after manual execution')
        .argument('<runId>', 'Run ID')
        .requiredOption('-c, --component <name>', 'Component name')
        .action(async (runId, options) => {
        await handleAfterExecution(runId, options.component);
    });
    // verify command
    program
        .command('verify')
        .description('Run verification for affected components')
        .argument('<runId>', 'Run ID')
        .action(async (runId) => {
        await handleVerify(runId);
    });
    // resume command
    program
        .command('resume')
        .description('Resume from latest checkpoint')
        .argument('<runId>', 'Run ID')
        .action(async (runId) => {
        await handleResume(runId);
    });
    // report command
    program
        .command('report')
        .description('Show final report for a run')
        .argument('<runId>', 'Run ID')
        .action(async (runId) => {
        await handleReport(runId);
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
async function handleInit(workspaceName, seaPath) {
    logger.info(`Initializing workspace: ${workspaceName}`);
    const workspaceConfig = {
        workspaceName,
        defaultExecutor: 'manual',
        approvalPolicy: createDefaultApprovalPolicy(),
        qualityGates: createDefaultQualityGates(),
        components: [],
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
    await fs.writeFile(memoryPath, `# Engineering Memory Log\n\nThis file stores past engineering decisions for future reference.\n`, 'utf-8');
    console.log(`✓ Workspace initialized at ${seaPath}`);
    console.log(`  - workspace.json created`);
    console.log(`  - engineering_memory.md created`);
    console.log(`\nNext steps:`);
    console.log(`  1. Configure components in ${configPath}`);
    console.log(`  2. Run: sea run "<request>" --workspace ${configPath}`);
}
async function handlePlan(request, workspacePath) {
    logger.info(`Running plan for: ${request}`);
    try {
        // Load workspace config
        const configContent = await fs.readFile(workspacePath, 'utf-8');
        const workspaceConfig = JSON.parse(configContent);
        // Generate run ID
        const runId = `run-${Date.now()}`;
        // Get actual workspace path (parent of .sea directory)
        const seaPath = path.dirname(workspacePath);
        // Fix workspaceConfig to use actual path as workspaceName
        const workspaceConfigForRun = {
            ...workspaceConfig,
            workspaceName: seaPath, // Pass actual path for discovery
        };
        // Create agents
        const agents = createSeaAgents({
            memoryPath: path.join(seaPath, 'engineering_memory.md'),
        });
        // Create workflow steps (planning phases only)
        const allSteps = createSeaWorkflowSteps(agents);
        const planningSteps = allSteps.filter((step) => {
            if (!('id' in step) || !step.id)
                return false;
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
        const runner = new WorkflowRunner({
            baseDir: seaPath,
            onPhaseComplete: (phase) => {
                console.log(`  ✓ ${phase} completed`);
            },
        });
        console.log(`Starting planning run: ${runId}`);
        console.log(`Request: ${request}\n`);
        // Run planning only
        const result = await runner.run(runId, request, workspaceConfigForRun, planningSteps);
        if (result.success) {
            console.log(`\n✓ Planning completed successfully`);
            console.log(`  Run ID: ${runId}`);
            console.log(`  Phases: ${result.completedPhases.join(' → ')}`);
        }
        else {
            console.log(`\n✗ Planning failed: ${result.error}`);
        }
    }
    catch (error) {
        logger.error(`Planning failed: ${error}`);
        console.error(`Error: ${error}`);
    }
}
async function handleRun(request, workspacePath, options) {
    logger.info(`Running: ${request}`);
    try {
        // Load workspace config
        const configPath = workspacePath;
        const configContent = await fs.readFile(configPath, 'utf-8');
        const workspaceConfig = JSON.parse(configContent);
        // Generate run ID
        const runId = `run-${Date.now()}`;
        // Get actual workspace path (parent of .sea directory)
        const seaPath = path.dirname(workspacePath);
        // Fix workspaceConfig to use actual path as workspaceName
        const workspaceConfigForRun = {
            ...workspaceConfig,
            workspaceName: seaPath,
        };
        // Create agents
        const agents = createSeaAgents({
            memoryPath: workspacePath, // Keep original for memory
        });
        // Create workflow steps
        const steps = createSeaWorkflowSteps(agents);
        // Create workflow runner
        const runner = new WorkflowRunner({
            baseDir: seaPath,
            onPhaseComplete: (phase, state) => {
                console.log(`  ✓ ${phase} completed`);
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
            console.log(`\n✓ Workflow completed successfully`);
            console.log(`  Run ID: ${runId}`);
            console.log(`  Phases completed: ${result.completedPhases.join(', ')}`);
        }
        else {
            console.log(`\n✗ Workflow failed: ${result.error}`);
            console.log(`  Completed phases: ${result.completedPhases.join(', ')}`);
        }
    }
    catch (error) {
        logger.error(`Workflow failed: ${error}`);
        console.error(`Error: ${error}`);
    }
}
async function handleRequest(runId, component, output) {
    logger.info(`Showing request for ${component} in run ${runId}`);
    console.log('Request command not yet implemented');
    console.log(`Run: ${runId}`);
    console.log(`Component: ${component}`);
}
async function handleAfterExecution(runId, component) {
    logger.info(`Capturing evidence for ${component} in run ${runId}`);
    console.log('After-execution command not yet implemented');
    console.log(`Run: ${runId}`);
    console.log(`Component: ${component}`);
}
async function handleVerify(runId) {
    logger.info(`Verifying run ${runId}`);
    console.log('Verify command not yet implemented');
    console.log(`Run: ${runId}`);
}
async function handleResume(runId) {
    logger.info(`Resuming run ${runId}`);
    try {
        // Find the workspace path from the run
        // Assume runs are in .sea/runs/{runId}
        const baseDir = '.sea';
        const runPath = path.join(baseDir, 'runs', runId);
        // Check if run exists
        const statePath = path.join(runPath, 'state.json');
        try {
            await fs.access(statePath);
        }
        catch {
            console.error(`Run ${runId} not found`);
            return;
        }
        // Load current state to get workspace config
        const stateContent = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(stateContent);
        // Create agents and steps
        const agents = createSeaAgents({
            memoryPath: path.join(baseDir, 'engineering_memory.md'),
        });
        const steps = createSeaWorkflowSteps(agents);
        // Create runner and resume
        const runner = new WorkflowRunner({
            baseDir,
            onPhaseComplete: (phase) => {
                console.log(`  ✓ ${phase} completed`);
            },
        });
        console.log(`Resuming run: ${runId}\n`);
        const result = await runner.resume(runId, steps);
        if (result.success) {
            console.log(`\n✓ Resume completed successfully`);
            console.log(`  Completed phases: ${result.completedPhases.join(' → ')}`);
        }
        else {
            console.log(`\n✗ Resume failed: ${result.error}`);
        }
    }
    catch (error) {
        logger.error(`Resume failed: ${error}`);
        console.error(`Error: ${error}`);
    }
}
async function handleReport(runId) {
    logger.info(`Showing report for run ${runId}`);
    try {
        // Load state file
        const baseDir = '.sea';
        const statePath = path.join(baseDir, 'runs', runId, 'state.json');
        const stateContent = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(stateContent);
        console.log(`\n═══════════════════════════════════════`);
        console.log(`  SEA Run Report: ${runId}`);
        console.log(`═══════════════════════════════════════\n`);
        if (state.userRequest) {
            console.log(`Request: ${state.userRequest}`);
        }
        if (state.finalDecision) {
            console.log(`\nFinal Decision: ${state.finalDecision.decision}`);
            console.log(`Summary: ${state.finalDecision.summary}`);
        }
        if (state.brutalRealityCheck) {
            const brc = state.brutalRealityCheck;
            console.log(`\nBrutal Reality Check (score: ${brc.score}/100)`);
            if (brc.real && brc.real.length > 0) {
                console.log(`  REAL:`);
                brc.real.forEach((item) => console.log(`    - ${item}`));
            }
            if (brc.partial && brc.partial.length > 0) {
                console.log(`  PARTIAL:`);
                brc.partial.forEach((item) => console.log(`    - ${item}`));
            }
            if (brc.fakeOrUnverified && brc.fakeOrUnverified.length > 0) {
                console.log(`  FAKE_OR_UNVERIFIED:`);
                brc.fakeOrUnverified.forEach((item) => console.log(`    - ${item}`));
            }
            if (brc.missing && brc.missing.length > 0) {
                console.log(`  MISSING:`);
                brc.missing.forEach((item) => console.log(`    - ${item}`));
            }
        }
        if (state.componentStates) {
            console.log(`\nComponents:`);
            for (const [name, cs] of Object.entries(state.componentStates)) {
                console.log(`  - ${name}: ${cs.componentDecision} (${cs.changedFiles?.length || 0} files)`);
            }
        }
        console.log(`\n═══════════════════════════════════════\n`);
    }
    catch (error) {
        logger.error(`Report failed: ${error}`);
        console.error(`Error: ${error}`);
    }
}
async function handleMemory(query) {
    if (query) {
        logger.info(`Searching memory: ${query}`);
        console.log('Memory search not yet implemented');
        console.log(`Query: ${query}`);
    }
    else {
        logger.info('Showing memory');
        console.log('Memory command not yet implemented');
    }
}
//# sourceMappingURL=commands.js.map
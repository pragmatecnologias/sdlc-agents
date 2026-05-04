/**
 * Workflow Runner for SEA
 * Executes workflow steps (sequence, parallel, condition, loop, approval)
 */
import { createInitialWorkspaceState } from '../state/workspaceState.js';
import { isNodeStep, isSequenceStep, isParallelStep, isConditionStep, isLoopStep, isApprovalStep, getStepId, } from './steps.js';
import { saveCheckpoint, loadCheckpoint, getLatestCheckpoint, saveState, } from './checkpoint.js';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('WorkflowRunner');
const DEFAULT_CHECKPOINT_INTERVAL = 1;
/**
 * Main workflow runner class
 */
export class WorkflowRunner {
    options;
    constructor(options = {}) {
        this.options = {
            baseDir: options.baseDir ?? '.sea',
            checkpointInterval: options.checkpointInterval ?? DEFAULT_CHECKPOINT_INTERVAL,
            onPhaseComplete: options.onPhaseComplete ?? (() => { }),
            onHumanApproval: options.onHumanApproval ?? (async () => true),
        };
    }
    /**
     * Run a complete workflow starting from initial state
     */
    async run(runId, userRequest, workspaceConfig, steps) {
        const initialState = createInitialWorkspaceState(runId, userRequest, workspaceConfig);
        return this.execute(initialState, steps);
    }
    /**
     * Resume a workflow from the latest checkpoint
     */
    async resume(runId, steps) {
        const latestCheckpoint = await getLatestCheckpoint(runId, this.options.baseDir);
        if (!latestCheckpoint) {
            throw new Error(`No checkpoints found for run ${runId}`);
        }
        const state = await loadCheckpoint(runId, latestCheckpoint.name.replace('.json', ''), this.options.baseDir);
        logger.info(`Resuming from checkpoint: ${latestCheckpoint.name}`);
        // Find the next step to execute
        const remainingSteps = this.getRemainingSteps(steps, latestCheckpoint.name);
        if (remainingSteps.length === 0) {
            return {
                success: true,
                aborted: false,
                state,
                completedPhases: steps.map(getStepId),
            };
        }
        return this.execute(state, remainingSteps, true);
    }
    /**
     * Execute a workflow starting from a given state
     */
    async execute(initialState, steps, isResume = false) {
        let state = initialState;
        const completedPhases = [];
        let stepIndex = 0;
        try {
            while (stepIndex < steps.length) {
                const step = steps[stepIndex];
                const stepId = getStepId(step);
                logger.info(`Executing step: ${stepId} (${step.type})`);
                const result = await this.executeStep(step, state);
                if (result.type === 'abort') {
                    return {
                        success: false,
                        aborted: true,
                        state: result.state,
                        error: 'Aborted by user',
                        completedPhases,
                    };
                }
                if (result.type === 'redirect') {
                    // Redirect to a different step (for condition/loop)
                    const redirectIndex = steps.findIndex(s => getStepId(s) === result.redirectTo);
                    if (redirectIndex === -1) {
                        throw new Error(`Redirect target not found: ${result.redirectTo}`);
                    }
                    stepIndex = redirectIndex;
                    if (result.state) {
                        state = { ...state, ...result.state, updatedAt: new Date().toISOString() };
                    }
                    continue;
                }
                if (result.state) {
                    state = { ...state, ...result.state, updatedAt: new Date().toISOString() };
                }
                completedPhases.push(stepId);
                this.options.onPhaseComplete(stepId, state);
                // Save checkpoint periodically
                if (completedPhases.length % this.options.checkpointInterval === 0) {
                    await saveCheckpoint(state, stepId, this.options.baseDir);
                }
                stepIndex++;
            }
            // Save final state
            await saveState(state, this.options.baseDir);
            logger.info('Workflow completed successfully');
            return {
                success: true,
                aborted: false,
                state,
                completedPhases,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Workflow failed at step ${getStepId(steps[stepIndex])}: ${errorMessage}`);
            return {
                success: false,
                aborted: false,
                state,
                error: errorMessage,
                completedPhases,
            };
        }
    }
    /**
     * Execute a single step
     */
    async executeStep(step, state) {
        if (isNodeStep(step)) {
            return this.executeNodeStep(step, state);
        }
        if (isSequenceStep(step)) {
            return this.executeSequenceStep(step, state);
        }
        if (isParallelStep(step)) {
            return this.executeParallelStep(step, state);
        }
        if (isConditionStep(step)) {
            return this.executeConditionStep(step, state);
        }
        if (isLoopStep(step)) {
            return this.executeLoopStep(step, state);
        }
        if (isApprovalStep(step)) {
            return this.executeApprovalStep(step, state);
        }
        throw new Error(`Unknown step type`);
    }
    /**
     * Execute a node step (simple agent execution)
     */
    async executeNodeStep(step, state) {
        try {
            const partialState = await step.run(state);
            return { type: 'continue', state: partialState };
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Execute a sequence of steps
     */
    async executeSequenceStep(step, state) {
        let currentState = state;
        for (const subStep of step.steps) {
            const result = await this.executeStep(subStep, currentState);
            if (result.type === 'abort' || result.type === 'redirect') {
                return result;
            }
            if (result.state) {
                currentState = { ...currentState, ...result.state, updatedAt: new Date().toISOString() };
            }
        }
        return { type: 'continue', state: {} };
    }
    /**
     * Execute parallel steps
     */
    async executeParallelStep(step, state) {
        const maxConcurrency = step.maxConcurrency ?? step.steps.length;
        const results = [];
        for (let i = 0; i < step.steps.length; i += maxConcurrency) {
            const batch = step.steps.slice(i, i + maxConcurrency);
            const batchResults = await Promise.all(batch.map(subStep => this.executeStep(subStep, state)));
            for (const result of batchResults) {
                if (result.type === 'abort' || result.type === 'redirect') {
                    return result;
                }
                if (result.state) {
                    results.push(result.state);
                }
            }
        }
        // Merge all results
        const mergedState = results.reduce((acc, r) => ({ ...acc, ...r }), {});
        return { type: 'continue', state: mergedState };
    }
    /**
     * Execute condition step (decide which branch to take)
     */
    async executeConditionStep(step, state) {
        const nextStep = step.decide(state);
        const redirectTo = getStepId(nextStep);
        return { type: 'redirect', redirectTo };
    }
    /**
     * Execute loop step (repeat until condition is met)
     */
    async executeLoopStep(step, state) {
        let currentState = state;
        let attempts = 0;
        while (attempts < step.maxAttempts && !step.until(currentState)) {
            const result = await this.executeStep(step.step, currentState);
            if (result.type === 'abort' || result.type === 'redirect') {
                return result;
            }
            if (result.state) {
                currentState = { ...currentState, ...result.state, updatedAt: new Date().toISOString() };
            }
            attempts++;
        }
        return { type: 'continue', state: {} };
    }
    /**
     * Execute approval step (prompt human for decision)
     */
    async executeApprovalStep(step, state) {
        if (!step.required) {
            return { type: 'continue', state: {} };
        }
        const approved = await this.options.onHumanApproval(step.message);
        if (!approved) {
            return { type: 'abort', state };
        }
        return { type: 'continue', state: {} };
    }
    /**
     * Get remaining steps after a checkpoint
     */
    getRemainingSteps(steps, checkpointName) {
        const checkpointPhase = checkpointName.replace('.json', '');
        const index = steps.findIndex(s => getStepId(s) === checkpointPhase);
        if (index === -1) {
            return steps;
        }
        return steps.slice(index + 1);
    }
}
/**
 * Create the standard SEA workflow steps
 */
export function createSeaWorkflowSteps(agents) {
    return [
        // Phase 1: Memory and Requirement
        { type: 'node', id: 'memory-retrieval', run: agents.memoryRetrievalAgent },
        { type: 'node', id: 'requirement-intake', run: agents.requirementIntakeAgent },
        // Phase 2: Discovery and Analysis
        { type: 'node', id: 'workspace-discovery', run: agents.workspaceDiscoveryAgent },
        { type: 'node', id: 'profile-detection', run: agents.projectProfileDetectorAgent },
        { type: 'node', id: 'component-mapping', run: agents.componentMapperAgent },
        { type: 'node', id: 'impact-analysis', run: agents.impactAnalysisAgent },
        // Phase 3: Planning
        { type: 'node', id: 'architecture-planning', run: agents.architecturePlanningAgent },
        { type: 'node', id: 'implementation-planning', run: agents.implementationPlanningAgent },
        // Phase 4: Approval
        {
            type: 'approval',
            id: 'human-approval',
            message: 'Do you approve the implementation plan?',
            required: true,
        },
        // Phase 5: Execution (loop for each component)
        // This would be expanded with actual component iteration
        { type: 'node', id: 'execution', run: agents.executionAgent },
        { type: 'node', id: 'diff-inspection', run: agents.diffInspectorAgent },
        // Phase 6: Verification
        { type: 'node', id: 'verification', run: agents.verificationAgent },
        { type: 'node', id: 'artifact-inspection', run: agents.artifactInspectionAgent },
        // Phase 7: Reviews
        { type: 'node', id: 'security-review', run: agents.securityReviewerAgent },
        { type: 'node', id: 'performance-review', run: agents.performanceReviewerAgent },
        { type: 'node', id: 'brutal-reality-check', run: agents.brutalRealityCheckAgent },
        // Phase 8: Final Decision
        { type: 'node', id: 'final-decision', run: agents.finalDecisionAgent },
        { type: 'node', id: 'memory-update', run: agents.memoryUpdateAgent },
        { type: 'node', id: 'release-writer', run: agents.releaseWriterAgent },
    ];
}
//# sourceMappingURL=runner.js.map
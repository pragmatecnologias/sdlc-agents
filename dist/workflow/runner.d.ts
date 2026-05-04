/**
 * Workflow Runner for SEA
 * Executes workflow steps (sequence, parallel, condition, loop, approval)
 */
import { WorkspaceState } from '../state/workspaceState.js';
import { WorkflowStep } from './steps.js';
export interface WorkflowResult {
    success: boolean;
    aborted: boolean;
    state: WorkspaceState | Partial<WorkspaceState>;
    error?: string;
    completedPhases: string[];
}
export interface WorkflowOptions {
    baseDir?: string;
    checkpointInterval?: number;
    onPhaseComplete?: (phase: string, state: WorkspaceState) => void;
    onHumanApproval?: (message: string) => Promise<boolean>;
}
/**
 * Main workflow runner class
 */
export declare class WorkflowRunner {
    private options;
    constructor(options?: WorkflowOptions);
    /**
     * Run a complete workflow starting from initial state
     */
    run(runId: string, userRequest: string, workspaceConfig: WorkspaceState['workspace'], steps: WorkflowStep[]): Promise<WorkflowResult>;
    /**
     * Resume a workflow from the latest checkpoint
     */
    resume(runId: string, steps: WorkflowStep[]): Promise<WorkflowResult>;
    /**
     * Execute a workflow starting from a given state
     */
    private execute;
    /**
     * Execute a single step
     */
    private executeStep;
    /**
     * Execute a node step (simple agent execution)
     */
    private executeNodeStep;
    /**
     * Execute a sequence of steps
     */
    private executeSequenceStep;
    /**
     * Execute parallel steps
     */
    private executeParallelStep;
    /**
     * Execute condition step (decide which branch to take)
     */
    private executeConditionStep;
    /**
     * Execute loop step (repeat until condition is met)
     */
    private executeLoopStep;
    /**
     * Execute approval step (prompt human for decision)
     */
    private executeApprovalStep;
    /**
     * Get remaining steps after a checkpoint
     */
    private getRemainingSteps;
}
/**
 * Create the standard SEA workflow steps
 */
export declare function createSeaWorkflowSteps(agents: SeaAgents): WorkflowStep[];
export interface SeaAgents {
    memoryRetrievalAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    requirementIntakeAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    workspaceDiscoveryAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    projectProfileDetectorAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    componentMapperAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    impactAnalysisAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    architecturePlanningAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    implementationPlanningAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    executionAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    diffInspectorAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    verificationAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    artifactInspectionAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    securityReviewerAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    performanceReviewerAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    brutalRealityCheckAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    finalDecisionAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    memoryUpdateAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
    releaseWriterAgent: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
}
//# sourceMappingURL=runner.d.ts.map
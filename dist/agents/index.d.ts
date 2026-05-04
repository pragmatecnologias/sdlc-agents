/**
 * SEA Agents Index
 * Centralizes all agent creation for the workflow
 */
import { WorkspaceState } from '../state/workspaceState.js';
export type SeaAgentFn = (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
export interface SeaAgents {
    memoryRetrievalAgent: SeaAgentFn;
    requirementIntakeAgent: SeaAgentFn;
    workspaceDiscoveryAgent: SeaAgentFn;
    projectProfileDetectorAgent: SeaAgentFn;
    componentMapperAgent: SeaAgentFn;
    impactAnalysisAgent: SeaAgentFn;
    architecturePlanningAgent: SeaAgentFn;
    implementationPlanningAgent: SeaAgentFn;
    executionAgent: SeaAgentFn;
    diffInspectorAgent: SeaAgentFn;
    verificationAgent: SeaAgentFn;
    artifactInspectionAgent: SeaAgentFn;
    securityReviewerAgent: SeaAgentFn;
    performanceReviewerAgent: SeaAgentFn;
    brutalRealityCheckAgent: SeaAgentFn;
    finalDecisionAgent: SeaAgentFn;
    memoryUpdateAgent: SeaAgentFn;
    releaseWriterAgent: SeaAgentFn;
}
export interface SeaAgentsOptions {
    memoryPath?: string;
}
/**
 * Create all SEA agents with the given options
 */
export declare function createSeaAgents(options?: SeaAgentsOptions): SeaAgents;
//# sourceMappingURL=index.d.ts.map
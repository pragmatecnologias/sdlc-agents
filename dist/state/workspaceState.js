/**
 * Core WorkspaceState type for SEA (Software Engineering Agents)
 * This is the central state object that flows through the entire workflow.
 */
// Re-export schemas
export { WorkspaceConfigSchema, RequirementReportSchema, ProjectProfileSchema, ComponentStateSchema, ExecutionGroupStateSchema, VerificationSummarySchema, ArtifactInspectionReportSchema, SecurityReviewReportSchema, PerformanceReviewReportSchema, BrutalRealityCheckReportSchema, FinalDecisionReportSchema, ApprovalRecordSchema, WorkflowErrorSchema, ArtifactRecordSchema, } from './schemas.js';
export { CommandResultSchema } from './schemas.js';
/**
 * Create initial workspace state for a new run
 */
export function createInitialWorkspaceState(runId, userRequest, workspace) {
    const now = new Date().toISOString();
    return {
        runId,
        createdAt: now,
        updatedAt: now,
        userRequest,
        workspace,
        projectProfile: null,
        memoryContext: null,
        requirement: null,
        workspaceDiscovery: null,
        componentMap: null,
        impactAnalysis: null,
        architecturePlan: null,
        implementationPlan: null,
        approvals: [],
        executionGroups: [],
        componentStates: {},
        verification: null,
        artifactInspections: [],
        securityReview: null,
        performanceReview: null,
        brutalRealityCheck: null,
        finalDecision: null,
        artifacts: [],
        errors: [],
    };
}
//# sourceMappingURL=workspaceState.js.map
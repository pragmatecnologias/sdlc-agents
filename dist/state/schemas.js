/**
 * Zod schemas for all SEA types
 * Used for validation and type inference
 */
import { z } from 'zod';
// ============================================================================
// Enums
// ============================================================================
export const ChangeRoleSchema = z.enum([
    'modify',
    'verify_only',
    'package_only',
    'artifact_verify',
    'no_change',
    'blocked',
    'unknown',
]);
export const ComponentKindSchema = z.enum([
    'ui',
    'frontend',
    'backend',
    'service',
    'assembly',
    'package',
    'library',
    'infra',
    'test',
    'docs',
    'game',
    'cli',
    'contract',
    'generated',
    'unknown',
]);
export const ComponentRoleSchema = z.enum([
    'source',
    'application',
    'service',
    'packager',
    'assembler',
    'contract',
    'test-suite',
    'infrastructure',
    'documentation',
    'generated',
    'verification-only',
]);
export const ProjectProfileNameSchema = z.enum([
    'SINGLE_REPO_FRONTEND',
    'SINGLE_REPO_BACKEND',
    'MONOREPO_WEB_APP',
    'MULTI_REPO_ENTERPRISE_APP',
    'WAR_COMPOSITE_APP',
    'SPRING_BOOT_SERVICE',
    'NODE_API',
    'REACT_APP',
    'ANGULAR_APP',
    'VUE_APP',
    'CHROME_EXTENSION',
    'THREEJS_GAME',
    'PYTHON_CLI',
    'LIBRARY_PACKAGE',
    'MICROSERVICES_WORKSPACE',
    'INFRASTRUCTURE_REPO',
    'DOCUMENTATION_REPO',
    'CUSTOM',
]);
export const ArtifactTypeSchema = z.enum([
    'none',
    'static-bundle',
    'jar',
    'war',
    'ear',
    'docker-image',
    'npm-package',
    'python-package',
    'browser-extension',
    'game-build',
    'custom',
]);
export const ExecutorTypeSchema = z.enum([
    'manual',
    'copilot-cli',
    'copilot-coding-agent',
    'claude-code',
    'codex-cli',
    'openclaw',
    'local-agent',
    'shell',
    'mock',
    'other',
]);
export const ExecutorStatusSchema = z.enum([
    'completed',
    'cancelled',
    'failed',
    'manual_required',
    'blocked',
]);
export const ComponentDecisionSchema = z.enum([
    'pending',
    'implemented',
    'verified',
    'needs_fix',
    'blocked',
    'skipped',
]);
export const ArchitectureDecisionSchema = z.enum([
    'proceed',
    'proceed_with_constraints',
    'revise_request',
    'reject',
    'blocked',
]);
export const FinalVerdictSchema = z.enum([
    'APPROVED',
    'APPROVED_WITH_NOTES',
    'NEEDS_FIXES',
    'REJECTED',
    'BLOCKED',
]);
export const CommandStatusSchema = z.enum(['passed', 'failed', 'skipped', 'blocked']);
export const SecurityStatusSchema = z.enum([
    'approved',
    'approved_with_notes',
    'needs_fix',
    'blocked',
]);
export const PerformanceStatusSchema = z.enum([
    'approved',
    'approved_with_notes',
    'needs_fix',
    'blocked',
]);
// ============================================================================
// Workspace Configuration
// ============================================================================
export const ComponentConfigSchema = z.object({
    name: z.string(),
    path: z.string(),
    kind: ComponentKindSchema,
    role: ComponentRoleSchema,
    technology: z.string().optional(),
    framework: z.string().optional(),
    packageManager: z.string().optional(),
    commands: z.object({
        install: z.string().optional(),
        lint: z.string().optional(),
        typecheck: z.string().optional(),
        test: z.string().optional(),
        build: z.string().optional(),
        package: z.string().optional(),
        e2e: z.string().optional(),
        smoke: z.string().optional(),
        custom: z.record(z.string()).optional(),
    }).optional(),
    artifact: z.object({
        type: ArtifactTypeSchema,
        outputPath: z.string().optional(),
        outputGlob: z.string().optional(),
        inspectionProfile: z.string().optional(),
        requiredEntries: z.array(z.string()).optional(),
        optionalEntries: z.array(z.string()).optional(),
    }).optional(),
    dependencies: z.array(z.string()).optional(),
    produces: z.array(z.string()).optional(),
    consumes: z.array(z.string()).optional(),
    contracts: z.array(z.object({
        type: z.string(),
        path: z.string().optional(),
    })).optional(),
    protectedPaths: z.array(z.string()).optional(),
    forbiddenPaths: z.array(z.string()).optional(),
    generatedPaths: z.array(z.string()).optional(),
    ignoredPaths: z.array(z.string()).optional(),
    notes: z.string().optional(),
});
export const ApprovalPolicySchema = z.object({
    requireBeforeImplementation: z.boolean(),
    requireForAuthChanges: z.boolean(),
    requireForDatabaseMigrations: z.boolean(),
    requireForPackageChanges: z.boolean(),
    requireForBuildConfigChanges: z.boolean(),
    requireForDeletingFiles: z.boolean(),
});
export const QualityGatesSchema = z.object({
    requireSourceRepoCleanBeforeRun: z.boolean(),
    requireFinalArtifactBuild: z.boolean(),
    requireArtifactInspection: z.boolean(),
    blockOnForbiddenPathModification: z.boolean(),
    blockOnProtectedPathModificationWithoutApproval: z.boolean(),
    warnIfNoSmokeTest: z.boolean(),
});
export const WorkspaceConfigSchema = z.object({
    workspaceName: z.string(),
    projectProfile: ProjectProfileNameSchema.optional(),
    defaultExecutor: z.string(),
    approvalPolicy: ApprovalPolicySchema,
    qualityGates: QualityGatesSchema,
    components: z.array(ComponentConfigSchema),
    globalProtectedPaths: z.array(z.string()).optional(),
    memory: z.object({
        enabled: z.boolean(),
        path: z.string(),
    }).optional(),
    artifacts: z.object({
        rootDir: z.string(),
    }).optional(),
});
// ============================================================================
// Requirement Report
// ============================================================================
export const RequirementReportSchema = z.object({
    title: z.string(),
    businessGoal: z.string(),
    functionalRequirements: z.array(z.string()),
    nonFunctionalRequirements: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
    outOfScope: z.array(z.string()),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    riskReasons: z.array(z.string()),
    approvalTriggers: z.array(z.string()),
    suspectedAffectedComponents: z.array(z.string()),
});
// ============================================================================
// Project Profile
// ============================================================================
export const ProjectProfileSchema = z.object({
    name: ProjectProfileNameSchema,
    confidence: z.number().min(0).max(1),
    requiredComponentRoles: z.array(z.string()),
    recommendedVerification: z.array(z.string()),
    requiredVerification: z.array(z.string()),
    artifactStrategy: z.string().optional(),
    notes: z.array(z.string()),
});
// ============================================================================
// Execution
// ============================================================================
export const ExecutionRequestSchema = z.object({
    workspaceRunId: z.string(),
    componentName: z.string(),
    componentPath: z.string(),
    taskTitle: z.string(),
    prompt: z.string(),
    allowedPaths: z.array(z.string()),
    protectedPaths: z.array(z.string()),
    forbiddenPaths: z.array(z.string()),
    mode: z.enum(['plan', 'edit', 'test', 'fix', 'review', 'docs', 'refactor']),
    interactive: z.boolean(),
    requireHumanApproval: z.boolean(),
    metadata: z.record(z.unknown()).optional(),
});
export const ExecutorResultSchema = z.object({
    executor: ExecutorTypeSchema,
    status: ExecutorStatusSchema,
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    exitCode: z.number().optional(),
    changedFiles: z.array(z.string()),
    diffPath: z.string().nullable(),
    startedAt: z.string(),
    finishedAt: z.string(),
    notes: z.array(z.string()).optional(),
});
// ============================================================================
// Component State
// ============================================================================
export const ComponentAnalysisReportSchema = z.object({
    componentName: z.string(),
    path: z.string(),
    kind: ComponentKindSchema,
    role: ComponentRoleSchema,
    technology: z.string().optional(),
    framework: z.string().optional(),
    buildSystem: z.string().optional(),
    testFramework: z.string().optional(),
    keyFiles: z.array(z.string()),
    dependencies: z.array(z.string()),
    insights: z.array(z.string()),
});
export const ComponentStateSchema = z.object({
    componentName: z.string(),
    componentPath: z.string(),
    kind: ComponentKindSchema,
    role: ComponentRoleSchema,
    changeRole: ChangeRoleSchema,
    branchBefore: z.string().nullable(),
    branchCreated: z.string().nullable(),
    dirtyBefore: z.boolean(),
    dirtyAfter: z.boolean(),
    analysis: ComponentAnalysisReportSchema.nullable(),
    plan: z.any().nullable(), // ComponentImplementationPlan - defer for now
    executionRequestPath: z.string().nullable(),
    executorResult: ExecutorResultSchema.nullable(),
    gitStatusBeforePath: z.string().nullable(),
    gitStatusAfterPath: z.string().nullable(),
    changedFiles: z.array(z.string()),
    forbiddenPathViolations: z.array(z.string()),
    protectedPathViolations: z.array(z.string()),
    diffPath: z.string().nullable(),
    commandResults: z.array(z.any()), // CommandResult - defer
    artifactInspection: z.any().nullable(), // ArtifactInspectionReport - defer
    fixAttempts: z.array(z.any()), // FixAttempt - defer
    componentDecision: ComponentDecisionSchema,
});
// ============================================================================
// Verification
// ============================================================================
export const CommandResultSchema = z.object({
    component: z.string(),
    commandName: z.string(),
    command: z.string(),
    exitCode: z.number(),
    status: CommandStatusSchema,
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    stdoutPath: z.string(),
    stderrPath: z.string(),
    durationMs: z.number(),
    startedAt: z.string(),
    finishedAt: z.string(),
});
export const VerificationSummarySchema = z.object({
    overallStatus: z.enum(['passed', 'failed', 'partial', 'skipped']),
    componentResults: z.record(z.object({
        status: CommandStatusSchema,
        commandsRun: z.number(),
        commandsPassed: z.number(),
        commandsFailed: z.number(),
    })),
    totalCommandsRun: z.number(),
    totalPassed: z.number(),
    totalFailed: z.number(),
    testsRun: z.boolean().optional(),
    buildsRun: z.boolean().optional(),
});
// ============================================================================
// Artifacts
// ============================================================================
export const ArtifactRecordSchema = z.object({
    component: z.string(),
    artifactType: ArtifactTypeSchema,
    path: z.string(),
    createdAt: z.string(),
    sizeBytes: z.number().optional(),
});
export const ArtifactInspectionReportSchema = z.object({
    component: z.string(),
    artifactType: ArtifactTypeSchema,
    artifactPath: z.string(),
    exists: z.boolean(),
    readable: z.boolean(),
    sizeBytes: z.number().optional(),
    entriesChecked: z.record(z.boolean()),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    status: z.enum(['passed', 'failed', 'warning', 'skipped']),
});
// ============================================================================
// Reviews
// ============================================================================
export const SecurityReviewReportSchema = z.object({
    status: SecurityStatusSchema,
    findings: z.array(z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        category: z.string(),
        description: z.string(),
        location: z.string().optional(),
        recommendation: z.string(),
    })),
    blockers: z.number(),
    warnings: z.array(z.string()),
    notes: z.array(z.string()),
});
export const PerformanceReviewReportSchema = z.object({
    status: PerformanceStatusSchema,
    findings: z.array(z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        category: z.string(),
        description: z.string(),
        location: z.string().optional(),
        recommendation: z.string(),
    })),
    blockers: z.number(),
    warnings: z.array(z.string()),
    notes: z.array(z.string()),
});
export const BrutalRealityCheckReportSchema = z.object({
    real: z.array(z.string()),
    partial: z.array(z.string()),
    fakeOrUnverified: z.array(z.string()),
    missing: z.array(z.string()),
    score: z.number().min(0).max(100),
    verdict: FinalVerdictSchema,
});
// ============================================================================
// Final Decision
// ============================================================================
export const FinalDecisionReportSchema = z.object({
    decision: FinalVerdictSchema,
    summary: z.string(),
    score: z.number().min(0).max(100),
    componentStatuses: z.array(z.object({
        component: z.string(),
        status: z.string(),
        reason: z.string(),
    })),
    evidence: z.object({
        diffsCaptured: z.boolean(),
        testsRun: z.boolean(),
        buildsRun: z.boolean(),
        artifactsInspected: z.boolean(),
        forbiddenPathViolations: z.number(),
        protectedPathViolations: z.number(),
        securityBlockers: z.number(),
        performanceBlockers: z.number(),
    }),
    requiredFixes: z.array(z.string()),
    warnings: z.array(z.string()),
    nextAction: z.string(),
});
// ============================================================================
// Workflow Support
// ============================================================================
export const ApprovalRecordSchema = z.object({
    timestamp: z.string(),
    type: z.string(),
    approved: z.boolean(),
    approver: z.string().optional(),
    reasons: z.array(z.string()).optional(),
    notes: z.string().optional(),
});
export const WorkflowErrorSchema = z.object({
    timestamp: z.string(),
    phase: z.string(),
    component: z.string().optional(),
    error: z.string(),
    recoverable: z.boolean(),
});
export const ExecutionGroupStateSchema = z.object({
    groupId: z.string(),
    description: z.string(),
    components: z.array(z.string()),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
});
// ============================================================================
// Default Factories
// ============================================================================
export function createDefaultApprovalPolicy() {
    return {
        requireBeforeImplementation: true,
        requireForAuthChanges: true,
        requireForDatabaseMigrations: true,
        requireForPackageChanges: true,
        requireForBuildConfigChanges: true,
        requireForDeletingFiles: true,
    };
}
export function createDefaultQualityGates() {
    return {
        requireSourceRepoCleanBeforeRun: true,
        requireFinalArtifactBuild: true,
        requireArtifactInspection: true,
        blockOnForbiddenPathModification: true,
        blockOnProtectedPathModificationWithoutApproval: true,
        warnIfNoSmokeTest: true,
    };
}
//# sourceMappingURL=schemas.js.map
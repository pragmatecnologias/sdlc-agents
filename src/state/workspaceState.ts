/**
 * Core WorkspaceState type for SEA (Software Engineering Agents)
 * This is the central state object that flows through the entire workflow.
 */

import { z } from 'zod';
import {
  WorkspaceConfigSchema,
  RequirementReportSchema,
  ProjectProfileSchema,
  ComponentStateSchema,
  ExecutionGroupStateSchema,
  VerificationSummarySchema,
  ArtifactInspectionReportSchema,
  SecurityReviewReportSchema,
  PerformanceReviewReportSchema,
  BrutalRealityCheckReportSchema,
  FinalDecisionReportSchema,
  ApprovalRecordSchema,
  WorkflowErrorSchema,
  ArtifactRecordSchema,
} from './schemas.js';

// Re-export schemas
export {
  WorkspaceConfigSchema,
  RequirementReportSchema,
  ProjectProfileSchema,
  ComponentStateSchema,
  ExecutionGroupStateSchema,
  VerificationSummarySchema,
  ArtifactInspectionReportSchema,
  SecurityReviewReportSchema,
  PerformanceReviewReportSchema,
  BrutalRealityCheckReportSchema,
  FinalDecisionReportSchema,
  ApprovalRecordSchema,
  WorkflowErrorSchema,
  ArtifactRecordSchema,
} from './schemas.js';

export { CommandResultSchema } from './schemas.js';

// Re-export types
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
export type RequirementReport = z.infer<typeof RequirementReportSchema>;
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
export type ComponentState = z.infer<typeof ComponentStateSchema>;
export type ExecutionGroupState = z.infer<typeof ExecutionGroupStateSchema>;
export type VerificationSummary = z.infer<typeof VerificationSummarySchema>;
export type ArtifactInspectionReport = z.infer<typeof ArtifactInspectionReportSchema>;
export type SecurityReviewReport = z.infer<typeof SecurityReviewReportSchema>;
export type PerformanceReviewReport = z.infer<typeof PerformanceReviewReportSchema>;
export type BrutalRealityCheckReport = z.infer<typeof BrutalRealityCheckReportSchema>;
export type FinalDecisionReport = z.infer<typeof FinalDecisionReportSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type WorkflowError = z.infer<typeof WorkflowErrorSchema>;
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;
export type CommandResult = z.infer<typeof import('./schemas.js').CommandResultSchema>;

/**
 * Main workspace state that flows through the entire SEA workflow.
 * This is the single source of truth for a run.
 */
export interface WorkspaceState {
  runId: string;
  createdAt: string;
  updatedAt: string;
  userRequest: string;
  baseDir: string;
  workspace: WorkspaceConfig;
  projectProfile: ProjectProfile | null;
  memoryContext: string | null;
  requirement: RequirementReport | null;
  workspaceDiscovery: WorkspaceDiscoveryReport | null;
  componentMap: ComponentMapReport | null;
  impactAnalysis: ImpactAnalysisReport | null;
  architecturePlan: ArchitecturePlan | null;
  implementationPlan: ImplementationPlan | null;
  approvals: ApprovalRecord[];
  executionGroups: ExecutionGroupState[];
  componentStates: Record<string, ComponentState>;
  verification: VerificationSummary | null;
  artifactInspections: ArtifactInspectionReport[];
  securityReview: SecurityReviewReport | null;
  performanceReview: PerformanceReviewReport | null;
  brutalRealityCheck: BrutalRealityCheckReport | null;
  finalDecision: FinalDecisionReport | null;
  artifacts: ArtifactRecord[];
  errors: WorkflowError[];
  runStatus: RunStatus;
  currentPhase: string;
}

export type RunStatus =
  | 'initialized'
  | 'planning'
  | 'awaiting_approval'
  | 'awaiting_manual_execution'
  | 'evidence_captured'
  | 'executing'
  | 'verifying'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'aborted';

/**
 * Report from workspace discovery agent
 */
export interface WorkspaceDiscoveryReport {
  workspacePath: string;
  isGitRepo: boolean;
  currentBranch: string;
  isDirty: boolean;
  components: DiscoveredComponent[];
  buildFiles: string[];
  testFolders: string[];
  frameworkHints: string[];
}

export interface DiscoveredComponent {
  name: string;
  path: string;
  type: string;
  hasBuildFile: boolean;
  buildFileType?: string;
}

/**
 * Report from component mapper agent
 */
export interface ComponentMapReport {
  components: ComponentRelationship[];
  dependencyGraph: Record<string, string[]>;
  artifactFlow: ArtifactFlow[];
}

export interface ComponentRelationship {
  component: string;
  produces: string[];
  consumes: string[];
  contracts: ContractInfo[];
}

export interface ContractInfo {
  type: string;
  path: string;
  consumers: string[];
}

export interface ArtifactFlow {
  fromComponent: string;
  toComponent: string;
  artifactType: string;
}

/**
 * Report from impact analysis agent
 */
export interface ImpactAnalysisReport {
  affectedComponents: AffectedComponent[];
  executionOrderHints: string[];
  crossComponentRisks: string[];
  contractRisks: string[];
  artifactRisks: string[];
  requiresHumanReview: boolean;
  humanReviewReasons: string[];
}

export interface AffectedComponent {
  component: string;
  changeRole: ChangeRole;
  reason: string;
}

export type ChangeRole =
  | 'modify'
  | 'verify_only'
  | 'package_only'
  | 'artifact_verify'
  | 'no_change'
  | 'blocked'
  | 'unknown';

/**
 * Architecture plan
 */
export interface ArchitecturePlan {
  decision: ArchitectureDecision;
  approach: string;
  componentResponsibilities: ComponentResponsibility[];
  constraints: string[];
  contractChanges: string[];
  artifactChanges: string[];
  executionOrder: string[];
  approvalRequired: boolean;
  approvalReasons: string[];
  rollbackStrategy: string[];
}

export type ArchitectureDecision =
  | 'proceed'
  | 'proceed_with_constraints'
  | 'revise_request'
  | 'reject'
  | 'blocked';

export interface ComponentResponsibility {
  component: string;
  responsibility: string;
}

/**
 * Implementation plan
 */
export interface ImplementationPlan {
  executionGroups: ExecutionGroupPlan[];
  componentPlans: ComponentImplementationPlan[];
}

export interface ExecutionGroupPlan {
  groupId: string;
  description: string;
  components: string[];
  parallel: boolean;
  dependsOn: string[];
}

export interface ComponentImplementationPlan {
  component: string;
  changeRole: ChangeRole;
  steps: string[];
  allowedPaths: string[];
  protectedPaths: string[];
  forbiddenPaths: string[];
  commands: ComponentCommands;
  definitionOfDone: string[];
  verificationExpectations: string[];
  requiresExecutor: boolean;
}

export interface ComponentCommands {
  install?: string;
  lint?: string;
  typecheck?: string;
  test?: string;
  build?: string;
  package?: string;
  e2e?: string;
  smoke?: string;
  custom?: Record<string, string>;
}

/**
 * Project profile names
 */
export type ProjectProfileName =
  | 'SINGLE_REPO_FRONTEND'
  | 'SINGLE_REPO_BACKEND'
  | 'MONOREPO_WEB_APP'
  | 'MULTI_REPO_ENTERPRISE_APP'
  | 'WAR_COMPOSITE_APP'
  | 'SPRING_BOOT_SERVICE'
  | 'NODE_API'
  | 'REACT_APP'
  | 'ANGULAR_APP'
  | 'VUE_APP'
  | 'CHROME_EXTENSION'
  | 'THREEJS_GAME'
  | 'PYTHON_CLI'
  | 'LIBRARY_PACKAGE'
  | 'MICROSERVICES_WORKSPACE'
  | 'INFRASTRUCTURE_REPO'
  | 'DOCUMENTATION_REPO'
  | 'CUSTOM';

/**
 * Component kind types
 */
export type ComponentKind =
  | 'ui'
  | 'frontend'
  | 'backend'
  | 'service'
  | 'assembly'
  | 'package'
  | 'library'
  | 'infra'
  | 'test'
  | 'docs'
  | 'game'
  | 'cli'
  | 'contract'
  | 'generated'
  | 'unknown';

/**
 * Component role types
 */
export type ComponentRole =
  | 'source'
  | 'application'
  | 'service'
  | 'packager'
  | 'assembler'
  | 'contract'
  | 'test-suite'
  | 'infrastructure'
  | 'documentation'
  | 'generated'
  | 'verification-only';

/**
 * Create initial workspace state for a new run
 */
export function createInitialWorkspaceState(
  runId: string,
  userRequest: string,
  workspace: WorkspaceConfig,
  baseDir: string
): WorkspaceState {
  const now = new Date().toISOString();
  return {
    runId,
    createdAt: now,
    updatedAt: now,
    userRequest,
    baseDir,
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
    runStatus: 'initialized',
    currentPhase: '',
  };
}

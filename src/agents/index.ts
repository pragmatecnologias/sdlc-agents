/**
 * SEA Agents Index
 * Centralizes all agent creation for the workflow
 */

import { WorkspaceState } from '../state/workspaceState.js';

import { createMemoryRetrievalAgent } from './memoryRetrievalAgent.js';
import { createRequirementIntakeAgent } from './requirementIntakeAgent.js';
import { createWorkspaceDiscoveryAgent } from './workspaceDiscoveryAgent.js';
import { createProjectProfileDetectorAgent } from './projectProfileDetectorAgent.js';
import { createComponentMapperAgent } from './componentMapperAgent.js';
import { createImpactAnalysisAgent } from './impactAnalysisAgent.js';
import { createArchitecturePlanningAgent } from './architecturePlanningAgent.js';
import { createImplementationPlanningAgent } from './implementationPlanningAgent.js';
import { createExecutionAgent } from './executionAgent.js';
import { createDiffInspectorAgent } from './diffInspectorAgent.js';
import { createVerificationAgent } from './verificationAgent.js';
import { createArtifactInspectionAgent } from './artifactInspectionAgent.js';
import { createSecurityReviewerAgent } from './securityReviewerAgent.js';
import { createPerformanceReviewerAgent } from './performanceReviewerAgent.js';
import { createBrutalRealityCheckAgent } from './brutalRealityCheckAgent.js';
import { createFinalDecisionAgent } from './finalDecisionAgent.js';
import { createMemoryUpdateAgent } from './memoryUpdateAgent.js';
import { createReleaseWriterAgent } from './releaseWriterAgent.js';

export type SeaAgentFn = (state: WorkspaceState, ...args: any[]) => Promise<Partial<WorkspaceState>>;

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
export function createSeaAgents(options: SeaAgentsOptions = {}): SeaAgents {
  return {
    memoryRetrievalAgent: createMemoryRetrievalAgent(options.memoryPath || '.sea/engineering_memory.md'),
    requirementIntakeAgent: createRequirementIntakeAgent(),
    workspaceDiscoveryAgent: createWorkspaceDiscoveryAgent(),
    projectProfileDetectorAgent: createProjectProfileDetectorAgent(),
    componentMapperAgent: createComponentMapperAgent(),
    impactAnalysisAgent: createImpactAnalysisAgent(),
    architecturePlanningAgent: createArchitecturePlanningAgent(),
    implementationPlanningAgent: createImplementationPlanningAgent(),
    executionAgent: createExecutionAgent(),
    diffInspectorAgent: createDiffInspectorAgent(),
    verificationAgent: createVerificationAgent(),
    artifactInspectionAgent: createArtifactInspectionAgent(),
    securityReviewerAgent: createSecurityReviewerAgent(),
    performanceReviewerAgent: createPerformanceReviewerAgent(),
    brutalRealityCheckAgent: createBrutalRealityCheckAgent(),
    finalDecisionAgent: createFinalDecisionAgent(),
    memoryUpdateAgent: createMemoryUpdateAgent(options.memoryPath || '.sea/engineering_memory.md'),
    releaseWriterAgent: createReleaseWriterAgent(),
  };
}

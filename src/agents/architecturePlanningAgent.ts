/**
 * Architecture Planning Agent for SEA
 * Creates system-level approach decision
 */

import {
  WorkspaceState,
  ArchitecturePlan,
  ArchitectureDecision,
  ComponentResponsibility,
} from '../state/workspaceState.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ArchitecturePlanningAgent');

/**
 * Create the architecture planning agent function
 */
export function createArchitecturePlanningAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running architecture planning agent');

    const { requirement, impactAnalysis, workspaceDiscovery } = state;

    if (!requirement) {
      throw new Error('Requirement report is required');
    }

    if (!impactAnalysis) {
      throw new Error('Impact analysis is required');
    }

    // Make architecture decision
    const decision = makeArchitectureDecision(requirement, impactAnalysis);

    // Determine component responsibilities
    const componentResponsibilities = determineResponsibilities(
      impactAnalysis.affectedComponents,
      requirement
    );

    // Determine constraints
    const constraints = determineConstraints(requirement, impactAnalysis);

    // Check if approval is required
    const approvalRequired = determineApprovalRequired(requirement, impactAnalysis);

    const plan: ArchitecturePlan = {
      decision,
      approach: generateApproach(decision, requirement, impactAnalysis),
      componentResponsibilities,
      constraints,
      contractChanges: determineContractChanges(impactAnalysis),
      artifactChanges: determineArtifactChanges(impactAnalysis),
      executionOrder: impactAnalysis.executionOrderHints,
      approvalRequired,
      approvalReasons: approvalRequired ? getApprovalReasons(requirement) : [],
      rollbackStrategy: generateRollbackStrategy(impactAnalysis),
    };

    return { architecturePlan: plan };
  };
}

function makeArchitectureDecision(
  requirement: WorkspaceState['requirement'],
  impactAnalysis: WorkspaceState['impactAnalysis']
): ArchitectureDecision {
  if (!requirement || !impactAnalysis) {
    return 'blocked';
  }

  // High risk requirements need constraints
  if (requirement.riskLevel === 'critical') {
    return 'proceed_with_constraints';
  }

  // Check for blocked components
  if (impactAnalysis.affectedComponents.some(c => c.changeRole === 'blocked')) {
    return 'blocked';
  }

  // Unknown impact requires human review
  if (impactAnalysis.requiresHumanReview) {
    return 'proceed_with_constraints';
  }

  // Database migrations require constraints
  if (
    requirement.riskReasons.some(r =>
      r.toLowerCase().includes('database')
    )
  ) {
    return 'proceed_with_constraints';
  }

  // Generally proceed for normal changes
  return 'proceed';
}

function determineResponsibilities(
  affectedComponents: { component: string; changeRole: string; reason: string }[],
  requirement: WorkspaceState['requirement']
): ComponentResponsibility[] {
  return affectedComponents
    .filter(c => c.changeRole === 'modify')
    .map(component => ({
      component: component.component,
      responsibility: `Implement changes for: ${requirement?.title || 'unspecified'}`,
    }));
}

function determineConstraints(
  requirement: WorkspaceState['requirement'],
  impactAnalysis: WorkspaceState['impactAnalysis']
): string[] {
  const constraints: string[] = [];

  if (!requirement) return constraints;

  // Add risk-based constraints
  if (requirement.riskLevel === 'high' || requirement.riskLevel === 'critical') {
    constraints.push('Full test suite must pass before merge');
    constraints.push('Code review required');
  }

  // Database constraints
  if (
    requirement.riskReasons.some(r =>
      r.toLowerCase().includes('database')
    )
  ) {
    constraints.push('Backup required before migration');
    constraints.push('Rollback plan must be documented');
  }

  // Security constraints
  if (
    requirement.riskReasons.some(r =>
      r.toLowerCase().includes('security')
    )
  ) {
    constraints.push('Security team review required');
    constraints.push('No sensitive data in logs');
  }

  // API constraints
  if (
    requirement.functionalRequirements.some(r =>
      r.toLowerCase().includes('api')
    )
  ) {
    constraints.push('Backward compatibility must be maintained');
    constraints.push('API versioning strategy required');
  }

  return constraints;
}

function determineApprovalRequired(
  requirement: WorkspaceState['requirement'],
  impactAnalysis: WorkspaceState['impactAnalysis']
): boolean {
  if (!requirement) return false;

  // Check approval triggers
  if (requirement.approvalTriggers.length > 0) {
    return true;
  }

  // Check for high-risk changes
  if (requirement.riskLevel === 'critical') {
    return true;
  }

  // Check for blocked components
  if (impactAnalysis?.affectedComponents.some(c => c.changeRole === 'blocked')) {
    return true;
  }

  return false;
}

function getApprovalReasons(
  requirement: WorkspaceState['requirement']
): string[] {
  const reasons: string[] = [];

  if (!requirement) return reasons;

  reasons.push(...requirement.approvalTriggers);

  if (requirement.riskLevel === 'critical') {
    reasons.push('Critical risk level requires approval');
  }

  return [...new Set(reasons)];
}

function determineContractChanges(
  impactAnalysis: WorkspaceState['impactAnalysis']
): string[] {
  const changes: string[] = [];

  if (!impactAnalysis) return changes;

  // Check for contract-related components
  for (const component of impactAnalysis.affectedComponents) {
    if (
      component.changeRole === 'modify' &&
      (component.component.toLowerCase().includes('api') ||
        component.component.toLowerCase().includes('contract'))
    ) {
      changes.push(`API contract for ${component.component} may need updating`);
    }
  }

  return changes;
}

function determineArtifactChanges(
  impactAnalysis: WorkspaceState['impactAnalysis']
): string[] {
  const changes: string[] = [];

  if (!impactAnalysis) return changes;

  // Check for assembly/packaging components
  for (const component of impactAnalysis.affectedComponents) {
    if (component.changeRole === 'package_only') {
      changes.push(`Artifact for ${component.component} needs rebuild`);
    }
  }

  return changes;
}

function generateRollbackStrategy(
  impactAnalysis: WorkspaceState['impactAnalysis']
): string[] {
  const strategy: string[] = [];

  if (!impactAnalysis) return ['git revert'];

  strategy.push('git revert <commit> to undo changes');

  // Component-specific rollbacks
  for (const component of impactAnalysis.affectedComponents) {
    if (component.changeRole === 'modify') {
      strategy.push(`${component.component}: revert to previous state`);
    }
  }

  return strategy;
}

function generateApproach(
  decision: ArchitectureDecision,
  requirement: WorkspaceState['requirement'],
  impactAnalysis: WorkspaceState['impactAnalysis']
): string {
  switch (decision) {
    case 'proceed':
      return `Implement ${requirement?.title || 'the requested feature'} following existing patterns.`;
    case 'proceed_with_constraints':
      return `Implement ${requirement?.title || 'the requested feature'} with additional verification and review.`;
    case 'revise_request':
      return 'The request needs revision before implementation.';
    case 'reject':
      return 'The proposed approach violates architecture constraints.';
    case 'blocked':
    default:
      return 'Implementation is blocked due to identified risks.';
  }
}

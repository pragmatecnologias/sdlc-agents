/**
 * Final Decision Agent for SEA
 * Produces final engineering decision with comprehensive checks
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { FinalDecisionReport, FinalVerdict } from '../state/schemas.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FinalDecisionAgent');

/**
 * Create the final decision agent function
 */
export function createFinalDecisionAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running final decision agent');

    const {
      requirement,
      verification,
      brutalRealityCheck,
      securityReview,
      performanceReview,
      componentStates,
      projectProfile,
      executionGroups,
    } = state;

    const cs = componentStates || {};

    // Collect evidence
    const evidence = {
      diffsCaptured: Object.values(cs).some(cs => cs.changedFiles.length > 0),
      testsRun: verification?.testsRun ?? false,
      buildsRun: verification?.buildsRun ?? false,
      artifactsInspected: (state.artifactInspections?.length ?? 0) > 0,
      forbiddenPathViolations: Object.values(cs).reduce(
        (sum, cs) => sum + cs.forbiddenPathViolations.length,
        0
      ),
      protectedPathViolations: Object.values(cs).reduce(
        (sum, cs) => sum + cs.protectedPathViolations.length,
        0
      ),
      securityBlockers: securityReview?.blockers ?? 0,
      performanceBlockers: performanceReview?.blockers ?? 0,
    };

    // Determine component statuses
    const componentStatuses = Object.entries(cs).map(
      ([componentName, cs]) => ({
        component: componentName,
        status: cs.componentDecision,
        reason: getComponentStatusReason(cs),
      })
    );

    // Collect required fixes
    const requiredFixes: string[] = [];

    if (brutalRealityCheck?.missing?.length) {
      requiredFixes.push(...brutalRealityCheck.missing);
    }

    if (verification?.totalFailed && verification.totalFailed > 0) {
      requiredFixes.push(`${verification.totalFailed} verification command(s) failed`);
    }

    // Check execution group statuses -- if any group failed, add required fix
    if (executionGroups) {
      for (const group of executionGroups) {
        if (group.status === 'failed') {
          requiredFixes.push(`Execution group "${group.groupId}" failed`);
        }
      }
    }

    // Check profile requiredVerification against actual verification
    if (projectProfile?.requiredVerification) {
      for (const requiredV of projectProfile.requiredVerification) {
        if (!isVerificationCovered(requiredV, cs, verification)) {
          requiredFixes.push(`Profile requires "${requiredV}" but it was not performed`);
        }
      }
    }

    // Collect warnings
    const warnings: string[] = [];

    if (brutalRealityCheck?.partial?.length) {
      warnings.push(...brutalRealityCheck.partial);
    }

    if (securityReview?.warnings?.length) {
      warnings.push(...securityReview.warnings);
    }

    if (performanceReview?.warnings?.length) {
      warnings.push(...performanceReview.warnings);
    }

    // Check profile recommendedVerification -- add warnings if not met (not blockers)
    if (projectProfile?.recommendedVerification) {
      for (const recV of projectProfile.recommendedVerification) {
        if (!isVerificationCovered(recV, cs, verification)) {
          warnings.push(`Profile recommends "${recV}" but it was not performed`);
        }
      }
    }

    // Determine verdict
    const verdict = determineVerdict(
      evidence,
      brutalRealityCheck?.verdict,
      securityReview?.status,
      performanceReview?.status,
      projectProfile,
      cs,
      verification,
      executionGroups
    );

    // Generate summary
    const summary = generateSummary(verdict, requirement?.title, componentStatuses);

    // Determine next action
    const nextAction = determineNextAction(verdict);

    const report: FinalDecisionReport = {
      decision: verdict,
      summary,
      score: brutalRealityCheck?.score ?? 0,
      componentStatuses,
      evidence,
      requiredFixes,
      warnings,
      nextAction,
    };

    logger.info(`Final decision: ${verdict}`);

    return { finalDecision: report };
  };
}

/**
 * Check whether a specific verification type was performed
 */
function isVerificationCovered(
  verificationType: string,
  componentStates: Record<string, any>,
  verification: any
): boolean {
  const typeLower = verificationType.toLowerCase();

  // Check command results across all components
  for (const cs of Object.values(componentStates)) {
    for (const cr of cs.commandResults || []) {
      if (cr.commandName.toLowerCase().includes(typeLower)) {
        return true;
      }
    }
  }

  // Check verification summary flags
  if (typeLower.includes('test') && verification?.testsRun) return true;
  if (typeLower.includes('build') && verification?.buildsRun) return true;
  if (typeLower.includes('security') && csHasAnyWith(componentStates, 'security')) return true;

  return false;
}

/**
 * Check if any component state has a particular key with a truthy value
 */
function csHasAnyWith(componentStates: Record<string, any>, key: string): boolean {
  return Object.values(componentStates).some((cs: any) => !!cs[key]);
}

function getComponentStatusReason(componentState: WorkspaceState['componentStates'][string]): string {
  if (componentState.componentDecision === 'verified') {
    return 'All checks passed';
  }
  if (componentState.componentDecision === 'needs_fix') {
    return 'Requires fixes before approval';
  }
  if (componentState.componentDecision === 'blocked') {
    return 'Blocked due to violations';
  }
  if (componentState.changeRole === 'no_change') {
    return 'No changes required';
  }
  if (componentState.changeRole === 'verify_only') {
    return 'Verification only';
  }
  return 'Pending';
}

function determineVerdict(
  evidence: FinalDecisionReport['evidence'],
  brutalVerdict?: FinalVerdict,
  securityStatus?: string,
  performanceStatus?: string,
  projectProfile?: WorkspaceState['projectProfile'],
  componentStates?: Record<string, any>,
  verification?: any,
  executionGroups?: any[]
): FinalVerdict {
  // Hard blockers: forbidden paths or security
  if (evidence.forbiddenPathViolations > 0) {
    return 'BLOCKED';
  }
  if (evidence.securityBlockers > 0) {
    return 'BLOCKED';
  }
  if (evidence.protectedPathViolations > 0) {
    return 'NEEDS_FIXES';
  }
  if (securityStatus === 'blocked') {
    return 'BLOCKED';
  }

  // Check execution group failures
  if (executionGroups) {
    const anyGroupFailed = executionGroups.some((g: any) => g.status === 'failed');
    if (anyGroupFailed) {
      return 'NEEDS_FIXES';
    }
  }

  // Check profile required verification -- if profile requires tests but none were run => NEEDS_FIXES
  if (projectProfile?.requiredVerification) {
    for (const reqV of projectProfile.requiredVerification) {
      if (
        reqV.toLowerCase().includes('test') &&
        verification &&
        !verification.testsRun
      ) {
        return 'NEEDS_FIXES';
      }
    }
  }

  // Check brutal reality check verdict
  if (brutalVerdict === 'REJECTED') {
    return 'REJECTED';
  }
  if (brutalVerdict === 'NEEDS_FIXES') {
    return 'NEEDS_FIXES';
  }

  // Check if all required evidence is present
  if (!evidence.diffsCaptured) {
    return 'NEEDS_FIXES';
  }

  // If profile requires tests but none were run (and no profile override above caught it)
  if (!evidence.testsRun) {
    return 'APPROVED_WITH_NOTES';
  }

  // Determine based on overall quality
  if (brutalVerdict === 'APPROVED') {
    return evidence.buildsRun ? 'APPROVED' : 'APPROVED_WITH_NOTES';
  }

  return 'APPROVED_WITH_NOTES';
}

function generateSummary(
  verdict: FinalVerdict,
  title?: string,
  componentStatuses?: FinalDecisionReport['componentStatuses']
): string {
  const componentCount = componentStatuses?.length ?? 0;
  const verifiedCount = componentStatuses?.filter(cs => cs.status === 'verified').length ?? 0;

  switch (verdict) {
    case 'APPROVED':
      return `Implementation of "${title}" is approved. All ${verifiedCount}/${componentCount} components verified.`;
    case 'APPROVED_WITH_NOTES':
      return `Implementation of "${title}" is approved with notes. ${verifiedCount}/${componentCount} components verified. Some optional validation is missing.`;
    case 'NEEDS_FIXES':
      return `Implementation of "${title}" requires fixes before approval. See required fixes for details.`;
    case 'REJECTED':
      return `Implementation of "${title}" is rejected. The approach violates requirements or evidence is insufficient.`;
    case 'BLOCKED':
      return `Implementation of "${title}" is blocked. Critical issues prevent approval.`;
    default:
      return `Decision on "${title}" could not be determined.`;
  }
}

function determineNextAction(verdict: FinalVerdict): string {
  switch (verdict) {
    case 'APPROVED':
      return 'open_pr';
    case 'APPROVED_WITH_NOTES':
      return 'open_pr_with_notes';
    case 'NEEDS_FIXES':
      return 'fix_issues';
    case 'REJECTED':
      return 'abandon';
    case 'BLOCKED':
      return 'review_manually';
    default:
      return 'review_manually';
  }
}

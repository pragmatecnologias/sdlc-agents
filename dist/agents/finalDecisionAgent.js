/**
 * Final Decision Agent for SEA
 * Produces final engineering decision
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('FinalDecisionAgent');
/**
 * Create the final decision agent function
 */
export function createFinalDecisionAgent() {
    return async (state) => {
        logger.info('Running final decision agent');
        const { requirement, verification, brutalRealityCheck, securityReview, performanceReview, componentStates, } = state;
        const cs = componentStates || {};
        // Collect evidence
        const evidence = {
            diffsCaptured: Object.values(cs).some(cs => cs.changedFiles.length > 0),
            testsRun: verification?.testsRun ?? false,
            buildsRun: verification?.buildsRun ?? false,
            artifactsInspected: (state.artifactInspections?.length ?? 0) > 0,
            forbiddenPathViolations: Object.values(cs).reduce((sum, cs) => sum + cs.forbiddenPathViolations.length, 0),
            protectedPathViolations: Object.values(cs).reduce((sum, cs) => sum + cs.protectedPathViolations.length, 0),
            securityBlockers: securityReview?.blockers ?? 0,
            performanceBlockers: performanceReview?.blockers ?? 0,
        };
        // Determine component statuses
        const componentStatuses = Object.entries(cs).map(([componentName, cs]) => ({
            component: componentName,
            status: cs.componentDecision,
            reason: getComponentStatusReason(cs),
        }));
        // Collect required fixes
        const requiredFixes = [];
        if (brutalRealityCheck?.missing?.length) {
            requiredFixes.push(...brutalRealityCheck.missing);
        }
        if (verification?.totalFailed && verification.totalFailed > 0) {
            requiredFixes.push(`${verification.totalFailed} verification commands failed`);
        }
        // Collect warnings
        const warnings = [];
        if (brutalRealityCheck?.partial?.length) {
            warnings.push(...brutalRealityCheck.partial);
        }
        if (securityReview?.warnings?.length) {
            warnings.push(...securityReview.warnings);
        }
        if (performanceReview?.warnings?.length) {
            warnings.push(...performanceReview.warnings);
        }
        // Determine verdict
        const verdict = determineVerdict(evidence, brutalRealityCheck?.verdict, securityReview?.status, performanceReview?.status);
        // Generate summary
        const summary = generateSummary(verdict, requirement?.title, componentStatuses);
        // Determine next action
        const nextAction = determineNextAction(verdict);
        const report = {
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
function getComponentStatusReason(componentState) {
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
function determineVerdict(evidence, brutalVerdict, securityStatus, performanceStatus) {
    // Hard blockers
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
    if (!evidence.testsRun) {
        return 'APPROVED_WITH_NOTES';
    }
    // Determine based on overall quality
    if (brutalVerdict === 'APPROVED') {
        return evidence.buildsRun ? 'APPROVED' : 'APPROVED_WITH_NOTES';
    }
    return 'APPROVED_WITH_NOTES';
}
function generateSummary(verdict, title, componentStatuses) {
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
            return `Implementation of "${title}" is rejected. The approach violates requirements.`;
        case 'BLOCKED':
            return `Implementation of "${title}" is blocked. Critical issues prevent approval.`;
        default:
            return `Decision on "${title}" could not be determined.`;
    }
}
function determineNextAction(verdict) {
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
//# sourceMappingURL=finalDecisionAgent.js.map
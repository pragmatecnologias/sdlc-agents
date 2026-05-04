/**
 * Brutal Reality Check Agent for SEA
 * Classifies evidence as REAL, PARTIAL, FAKE_OR_UNVERIFIED, or MISSING
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('BrutalRealityCheckAgent');
/**
 * Create the brutal reality check agent function
 */
export function createBrutalRealityCheckAgent() {
    return async (state) => {
        logger.info('Running brutal reality check agent');
        const { requirement, verification, componentStates, securityReview, } = state;
        const real = [];
        const partial = [];
        const fakeOrUnverified = [];
        const missing = [];
        // Check if diffs were captured
        const hasDiffs = Object.values(componentStates || {}).some(cs => cs.changedFiles && cs.changedFiles.length > 0);
        if (hasDiffs) {
            real.push('Component diffs were captured');
        }
        else {
            fakeOrUnverified.push('No diffs captured - changes may not exist');
        }
        // Check if tests were run
        if (verification) {
            if (verification.testsRun) {
                real.push('Verification commands were executed');
            }
            else {
                missing.push('Verification was not run');
            }
            if (verification.totalFailed && verification.totalFailed > 0) {
                partial.push(`${verification.totalFailed} verification commands failed`);
            }
        }
        // Check component-level verification
        for (const [componentName, componentState] of Object.entries(componentStates || {})) {
            if (componentState.changeRole === 'modify') {
                if (componentState.changedFiles.length === 0) {
                    fakeOrUnverified.push(`${componentName}: marked as modify but no files changed`);
                }
                if (componentState.forbiddenPathViolations.length > 0) {
                    fakeOrUnverified.push(`${componentName}: modified forbidden paths`);
                }
            }
            if (componentState.commandResults.length === 0 && componentState.changeRole === 'modify') {
                missing.push(`${componentName}: no command results captured`);
            }
        }
        // Check security review
        if (securityReview) {
            if (securityReview.status === 'approved') {
                real.push('Security review passed');
            }
            else if (securityReview.status === 'blocked') {
                fakeOrUnverified.push('Security review found blockers');
            }
        }
        // Check for missing tests
        if (requirement) {
            let hasAnyTests = false;
            for (const cs of Object.values(componentStates || {})) {
                if (cs.commandResults?.some(r => r.commandName.includes('test'))) {
                    hasAnyTests = true;
                    break;
                }
            }
            if (!hasAnyTests && requirement.functionalRequirements.length > 0) {
                missing.push('No tests were run for functional requirements');
            }
        }
        // Calculate score
        const totalChecks = real.length + partial.length + fakeOrUnverified.length + missing.length;
        const score = totalChecks > 0
            ? Math.round((real.length / totalChecks) * 100)
            : 0;
        // Determine verdict
        let verdict;
        if (fakeOrUnverified.length > 0 || missing.length > 2) {
            verdict = 'NEEDS_FIXES';
        }
        else if (partial.length > 0 || missing.length > 0) {
            verdict = 'APPROVED_WITH_NOTES';
        }
        else if (score >= 80) {
            verdict = 'APPROVED';
        }
        else {
            verdict = 'NEEDS_FIXES';
        }
        const report = {
            real,
            partial,
            fakeOrUnverified,
            missing,
            score,
            verdict,
        };
        logger.info(`Brutal reality check complete: ${verdict} (score: ${score})`);
        return { brutalRealityCheck: report };
    };
}
//# sourceMappingURL=brutalRealityCheckAgent.js.map
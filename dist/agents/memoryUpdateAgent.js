/**
 * Memory Update Agent for SEA
 * Logs engineering decisions for future reference
 */
import { createMemoryEntry } from './memoryRetrievalAgent.js';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('MemoryUpdateAgent');
/**
 * Create the memory update agent function
 */
export function createMemoryUpdateAgent(memoryPath = '.sea/engineering_memory.md') {
    return async (state) => {
        logger.info('Running memory update agent');
        const { requirement, finalDecision, brutalRealityCheck, workspace, componentStates, } = state;
        // Check if memory is enabled
        if (workspace.memory?.enabled === false) {
            return { memoryContext: null };
        }
        // Don't log if no requirement or decision
        if (!requirement || !finalDecision) {
            return { memoryContext: null };
        }
        // Extract lessons from the run
        const whatWorked = extractWhatWorked(state);
        const whatFailed = extractWhatFailed(state);
        const lessons = extractLessons(state);
        // Generate rules for future runs
        const rules = generateRules(state);
        const effectiveMemoryPath = workspace.memory?.path || memoryPath;
        try {
            await createMemoryEntry({
                date: new Date().toISOString().split('T')[0],
                request: requirement.title,
                decision: finalDecision.decision,
                whatWorked,
                whatFailed,
                lessons,
                rules,
                relatedEntries: [],
            }, effectiveMemoryPath);
            logger.info('Memory entry created successfully');
        }
        catch (error) {
            logger.warn('Failed to create memory entry', error);
        }
        return { memoryContext: lessons.join('; ') };
    };
}
function extractWhatWorked(state) {
    const worked = [];
    if (state.finalDecision?.decision === 'APPROVED') {
        worked.push('Implementation passed all quality gates');
    }
    if (state.verification?.totalFailed === 0) {
        worked.push('All verification commands passed');
    }
    if (state.componentStates) {
        for (const [name, cs] of Object.entries(state.componentStates)) {
            if (cs.componentDecision === 'verified') {
                worked.push(`${name}: component verified successfully`);
            }
        }
    }
    return worked;
}
function extractWhatFailed(state) {
    const failed = [];
    if (state.verification && state.verification.totalFailed && state.verification.totalFailed > 0) {
        failed.push(`${state.verification.totalFailed} verification commands failed`);
    }
    if (state.brutalRealityCheck?.fakeOrUnverified.length) {
        failed.push(...state.brutalRealityCheck.fakeOrUnverified);
    }
    if (state.finalDecision?.requiredFixes.length) {
        failed.push(...state.finalDecision.requiredFixes);
    }
    for (const [name, cs] of Object.entries(state.componentStates || {})) {
        if (cs.forbiddenPathViolations.length > 0) {
            failed.push(`${name}: violated forbidden path restrictions`);
        }
    }
    return failed;
}
function extractLessons(state) {
    const lessons = [];
    if (state.brutalRealityCheck) {
        if (state.brutalRealityCheck.score < 80) {
            lessons.push('Reality check score was below 80% - need better verification');
        }
    }
    if (state.finalDecision?.decision === 'NEEDS_FIXES') {
        lessons.push('Implementation required fixes - improve pre-flight checks');
    }
    if (state.componentStates) {
        for (const [name, cs] of Object.entries(state.componentStates)) {
            if (cs.changedFiles.length > 50) {
                lessons.push(`${name}: Large diff (>50 files) - consider smaller PRs`);
            }
        }
    }
    if (state.securityReview?.findings.length) {
        lessons.push('Security findings suggest need for security-focused review');
    }
    return lessons;
}
function generateRules(state) {
    const rules = [];
    // Add rules based on what happened
    if (state.finalDecision?.decision === 'NEEDS_FIXES') {
        rules.push('Run verification before marking implementation complete');
    }
    if (state.componentStates) {
        for (const [name, cs] of Object.entries(state.componentStates)) {
            if (cs.forbiddenPathViolations.length > 0) {
                rules.push(`Check forbidden path patterns before modifying ${name}`);
            }
        }
    }
    if (state.securityReview?.findings.some(f => f.severity === 'high')) {
        rules.push('For security-related changes, enable security review gate');
    }
    return rules;
}
//# sourceMappingURL=memoryUpdateAgent.js.map
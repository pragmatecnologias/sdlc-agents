/**
 * Release Writer Agent for SEA
 * Generates release notes and final report
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ReleaseWriterAgent');
/**
 * Create the release writer agent function
 */
export function createReleaseWriterAgent() {
    return async (state) => {
        logger.info('Running release writer agent');
        const { requirement, finalDecision, componentStates } = state;
        const releaseNotes = generateReleaseNotes(state);
        logger.info('Release notes generated');
        // Return empty - actual file writing happens via checkpoint/artifact system
        return {};
    };
}
function generateReleaseNotes(state) {
    const lines = [
        `# Release Notes - ${state.runId}`,
        '',
        `**Request:** ${state.requirement?.title || 'N/A'}`,
        `**Decision:** ${state.finalDecision?.decision || 'PENDING'}`,
        `**Date:** ${new Date().toISOString().split('T')[0]}`,
        '',
        '## Summary',
        state.finalDecision?.summary || 'No summary available.',
        '',
        '## Components',
    ];
    for (const [name, cs] of Object.entries(state.componentStates || {})) {
        lines.push(`- **${name}**: ${cs.componentDecision} (${cs.changedFiles.length} files changed)`);
    }
    if (state.finalDecision?.requiredFixes?.length) {
        lines.push('', '## Required Fixes');
        for (const fix of state.finalDecision.requiredFixes) {
            lines.push(`- ${fix}`);
        }
    }
    if (state.finalDecision?.warnings?.length) {
        lines.push('', '## Warnings');
        for (const warning of state.finalDecision.warnings) {
            lines.push(`- ${warning}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=releaseWriterAgent.js.map
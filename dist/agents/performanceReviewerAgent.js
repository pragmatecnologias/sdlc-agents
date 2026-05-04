/**
 * Performance Reviewer Agent for SEA
 * Reviews changes for performance issues
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('PerformanceReviewerAgent');
/**
 * Create the performance reviewer agent function
 */
export function createPerformanceReviewerAgent() {
    return async (state) => {
        logger.info('Running performance reviewer agent');
        const { componentStates } = state;
        const report = {
            status: 'approved',
            findings: [],
            blockers: 0,
            warnings: [],
            notes: [],
        };
        // Check for performance-related file changes
        for (const [componentName, componentState] of Object.entries(componentStates || {})) {
            if (componentState.changeRole !== 'modify')
                continue;
            // Check for performance-critical files
            const perfCriticalPatterns = [
                'index.js',
                'main.js',
                'App.js',
                'server.js',
                'api.ts',
                'handler.ts',
            ];
            for (const file of componentState.changedFiles) {
                const fileName = file.split('/').pop() || '';
                if (perfCriticalPatterns.includes(fileName)) {
                    report.findings.push({
                        severity: 'medium',
                        category: 'hot-path',
                        description: `Performance-critical file modified: ${file}`,
                        recommendation: 'Ensure no performance regressions in hot paths',
                    });
                }
            }
            // Check for large diffs
            if (componentState.changedFiles.length > 20) {
                report.warnings.push(`Large change to ${componentName}: ${componentState.changedFiles.length} files`);
            }
        }
        // Determine status
        if (report.blockers > 0) {
            report.status = 'blocked';
        }
        else if (report.warnings.length > 0) {
            report.status = 'approved_with_notes';
        }
        logger.info(`Performance review: ${report.status}`);
        return { performanceReview: report };
    };
}
//# sourceMappingURL=performanceReviewerAgent.js.map
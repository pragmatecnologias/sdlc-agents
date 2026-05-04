/**
 * Execution Agent for SEA
 * Executes implementation via executor adapter
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ExecutionAgent');
/**
 * Create the execution agent function
 */
export function createExecutionAgent() {
    return async (state) => {
        logger.info('Running execution agent');
        const { componentStates } = state;
        // Track execution state - actual execution happens via executor
        const executionSummary = {
            componentsExecuted: Object.values(componentStates || {}).filter(cs => cs.executorResult !== null).length,
            totalComponents: Object.keys(componentStates || {}).length,
        };
        logger.info(`Execution complete: ${executionSummary.componentsExecuted}/${executionSummary.totalComponents} components`);
        // Note: actual execution is handled by the executor adapter
        // This agent just tracks the state
        return {};
    };
}
//# sourceMappingURL=executionAgent.js.map
/**
 * Executor Adapter Interface for SEA
 * Defines the contract for all executors (Manual, Copilot, Claude Code, etc.)
 */
import { ExecutionRequestSchema, ExecutorResultSchema } from '../state/schemas.js';
export { ExecutionRequestSchema, ExecutorResultSchema };
/**
 * Create a basic executor result
 */
export function createExecutorResult(partial) {
    return {
        changedFiles: [],
        diffPath: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        ...partial,
    };
}
/**
 * Check if executor result indicates success
 */
export function isSuccessful(result) {
    return result.status === 'completed';
}
//# sourceMappingURL=executorAdapter.js.map
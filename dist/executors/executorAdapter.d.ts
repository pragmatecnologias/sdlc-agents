/**
 * Executor Adapter Interface for SEA
 * Defines the contract for all executors (Manual, Copilot, Claude Code, etc.)
 */
import { z } from 'zod';
import { ExecutionRequestSchema, ExecutorResultSchema } from '../state/schemas.js';
export { ExecutionRequestSchema, ExecutorResultSchema };
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export type ExecutorResult = z.infer<typeof ExecutorResultSchema>;
/**
 * Executor adapter interface
 * All executors (Manual, Copilot, Claude Code, etc.) must implement this interface
 */
export interface ExecutorAdapter {
    /**
     * Name of the executor
     */
    name: string;
    /**
     * Execute a component implementation task
     */
    execute(request: ExecutionRequest): Promise<ExecutorResult>;
    /**
     * Check if executor is available (e.g., tool is installed)
     */
    isAvailable(): Promise<boolean>;
}
/**
 * Execution modes
 */
export type ExecutionMode = 'plan' | 'edit' | 'test' | 'fix' | 'review' | 'docs' | 'refactor';
/**
 * Create a basic executor result
 */
export declare function createExecutorResult(partial: Partial<ExecutorResult> & Pick<ExecutorResult, 'executor' | 'status'>): ExecutorResult;
/**
 * Check if executor result indicates success
 */
export declare function isSuccessful(result: ExecutorResult): boolean;
//# sourceMappingURL=executorAdapter.d.ts.map
/**
 * Mock Executor for testing SEA
 */
import { ExecutorAdapter, ExecutionRequest, ExecutorResult } from './executorAdapter.js';
export interface MockExecutorOptions {
    shouldSucceed?: boolean;
    changedFiles?: string[];
    diff?: string;
    stdout?: string;
    stderr?: string;
    delayMs?: number;
}
export declare class MockExecutor implements ExecutorAdapter {
    name: string;
    private options;
    constructor(options?: MockExecutorOptions);
    execute(request: ExecutionRequest): Promise<ExecutorResult>;
    isAvailable(): Promise<boolean>;
}
//# sourceMappingURL=mockExecutor.d.ts.map
/**
 * Mock Executor for testing SEA
 */
import { createExecutorResult } from './executorAdapter.js';
export class MockExecutor {
    name = 'mock';
    options;
    constructor(options = {}) {
        this.options = {
            shouldSucceed: true,
            changedFiles: ['src/example.ts'],
            diff: 'diff --git a/src/example.ts b/src/example.ts\n...',
            stdout: 'Mock executor completed',
            stderr: '',
            delayMs: 100,
            ...options,
        };
    }
    async execute(request) {
        const startedAt = new Date().toISOString();
        // Simulate execution delay
        if (this.options.delayMs && this.options.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.delayMs));
        }
        const finishedAt = new Date().toISOString();
        return createExecutorResult({
            executor: 'mock',
            status: this.options.shouldSucceed ? 'completed' : 'failed',
            stdout: this.options.stdout,
            stderr: this.options.stderr,
            exitCode: this.options.shouldSucceed ? 0 : 1,
            changedFiles: this.options.changedFiles ?? [],
            diffPath: null,
            startedAt,
            finishedAt,
        });
    }
    async isAvailable() {
        return true;
    }
}
//# sourceMappingURL=mockExecutor.js.map
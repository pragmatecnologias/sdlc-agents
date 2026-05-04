/**
 * Mock Executor for testing SEA
 */

import { ExecutorAdapter, ExecutionRequest, ExecutorResult, createExecutorResult } from './executorAdapter.js';

export interface MockExecutorOptions {
  shouldSucceed?: boolean;
  changedFiles?: string[];
  diff?: string;
  stdout?: string;
  stderr?: string;
  delayMs?: number;
}

export class MockExecutor implements ExecutorAdapter {
  name = 'mock';
  private options: MockExecutorOptions;

  constructor(options: MockExecutorOptions = {}) {
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

  async execute(request: ExecutionRequest): Promise<ExecutorResult> {
    const startedAt = new Date().toISOString();

    // Simulate execution delay
    if (this.options.delayMs && this.options.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.delayMs!));
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

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Manual Executor for SEA
 * Generates execution request files for human execution
 * Human performs work externally, then SEA continues with verification
 */
import { ExecutorAdapter, ExecutionRequest, ExecutorResult } from './executorAdapter.js';
export declare class ManualExecutor implements ExecutorAdapter {
    name: string;
    private runId;
    private baseDir;
    constructor(runId: string, baseDir?: string);
    execute(request: ExecutionRequest): Promise<ExecutorResult>;
    isAvailable(): Promise<boolean>;
    private generateExecutionRequest;
    private getComponentArtifactDir;
}
/**
 * Capture evidence after manual execution
 */
export declare function captureManualExecutionEvidence(runId: string, componentName: string, baseDir?: string): Promise<{
    changedFiles: string[];
    diff: string;
    gitStatus: string;
}>;
//# sourceMappingURL=manualExecutor.d.ts.map
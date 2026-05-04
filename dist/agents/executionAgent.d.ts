/**
 * Execution Agent for SEA
 * Executes implementation via executor adapter
 */
import { WorkspaceState } from '../state/workspaceState.js';
/**
 * Create the execution agent function
 */
export declare function createExecutionAgent(): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=executionAgent.d.ts.map
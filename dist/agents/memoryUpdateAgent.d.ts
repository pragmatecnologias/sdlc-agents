/**
 * Memory Update Agent for SEA
 * Logs engineering decisions for future reference
 */
import { WorkspaceState } from '../state/workspaceState.js';
/**
 * Create the memory update agent function
 */
export declare function createMemoryUpdateAgent(memoryPath?: string): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=memoryUpdateAgent.d.ts.map
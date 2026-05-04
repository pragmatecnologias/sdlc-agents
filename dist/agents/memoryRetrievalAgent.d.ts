/**
 * Memory Retrieval Agent for SEA
 * Retrieves relevant past engineering decisions from memory
 */
import { WorkspaceState } from '../state/workspaceState.js';
export interface MemoryEntry {
    id: string;
    date: string;
    request: string;
    decision: string;
    whatWorked: string[];
    whatFailed: string[];
    lessons: string[];
    rules: string[];
    relatedEntries: string[];
}
/**
 * Create the memory retrieval agent function
 */
export declare function createMemoryRetrievalAgent(memoryPath?: string): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
/**
 * Create a new memory entry
 */
export declare function createMemoryEntry(entry: Omit<MemoryEntry, 'id'>, memoryPath?: string): Promise<void>;
//# sourceMappingURL=memoryRetrievalAgent.d.ts.map
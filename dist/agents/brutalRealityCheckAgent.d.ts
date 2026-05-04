/**
 * Brutal Reality Check Agent for SEA
 * Classifies evidence as REAL, PARTIAL, FAKE_OR_UNVERIFIED, or MISSING
 */
import { WorkspaceState } from '../state/workspaceState.js';
/**
 * Create the brutal reality check agent function
 */
export declare function createBrutalRealityCheckAgent(): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=brutalRealityCheckAgent.d.ts.map
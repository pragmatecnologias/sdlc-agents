/**
 * Diff Inspector Agent for SEA
 * Inspects git diff and validates against allowed/protected/forbidden paths
 */
import { WorkspaceState } from '../state/workspaceState.js';
export interface DiffInspectionResult {
    changedFiles: string[];
    forbiddenPathViolations: string[];
    protectedPathViolations: string[];
    diffClean: boolean;
    warnings: string[];
}
/**
 * Create the diff inspector agent function
 */
export declare function createDiffInspectorAgent(): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=diffInspectorAgent.d.ts.map
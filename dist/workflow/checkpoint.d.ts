/**
 * Checkpoint system for SEA workflow
 * Saves and loads workspace state at each phase
 */
import { WorkspaceState } from '../state/workspaceState.js';
export interface CheckpointPaths {
    baseDir: string;
    runsDir: string;
    runDir: string;
    checkpointsDir: string;
    artifactsDir: string;
    componentsDir: string;
}
export interface CheckpointInfo {
    name: string;
    path: string;
    timestamp: string;
}
/**
 * Get paths for a run
 */
export declare function getRunPaths(runId: string, baseDir?: string): CheckpointPaths;
/**
 * Create checkpoint name from phase name
 */
export declare function checkpointName(phase: string): string;
/**
 * Save a checkpoint
 */
export declare function saveCheckpoint(state: WorkspaceState, phase: string, baseDir?: string): Promise<void>;
/**
 * Load a checkpoint
 */
export declare function loadCheckpoint(runId: string, phase: string, baseDir?: string): Promise<WorkspaceState>;
/**
 * List all checkpoints for a run
 */
export declare function listCheckpoints(runId: string, baseDir?: string): Promise<CheckpointInfo[]>;
/**
 * Get the latest checkpoint
 */
export declare function getLatestCheckpoint(runId: string, baseDir?: string): Promise<CheckpointInfo | null>;
/**
 * Save full state (not a checkpoint, but current state)
 */
export declare function saveState(state: WorkspaceState, baseDir?: string): Promise<void>;
/**
 * Load full state
 */
export declare function loadState(runId: string, baseDir?: string): Promise<WorkspaceState>;
/**
 * Save an artifact file
 */
export declare function saveArtifact(state: WorkspaceState, name: string, content: string, baseDir?: string): Promise<void>;
/**
 * Save a component-specific artifact
 */
export declare function saveComponentArtifact(state: WorkspaceState, componentName: string, name: string, content: string, baseDir?: string): Promise<void>;
/**
 * Save component state
 */
export declare function saveComponentState(state: WorkspaceState, componentName: string, baseDir?: string): Promise<void>;
//# sourceMappingURL=checkpoint.d.ts.map
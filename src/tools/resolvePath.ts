/**
 * Centralized component path resolution for SEA
 *
 * Every command, git operation, artifact inspection, and execution request
 * must use this function to resolve component paths to absolute paths.
 *
 * Component paths in workspace config are relative to the workspace root
 * (the parent directory of .sea/). This function resolves them to absolute paths.
 */

import * as path from 'path';
import { WorkspaceState } from '../state/workspaceState.js';
import { ComponentConfig } from '../state/schemas.js';

/**
 * Resolve the .sea directory path from a workspace config path.
 */
export function resolveSeaDir(workspacePath: string): string {
  return path.dirname(workspacePath);
}

/**
 * Resolve the workspace root (parent of .sea/) from a workspace config path.
 */
export function resolveWorkspaceRoot(workspacePath: string): string {
  return path.dirname(path.dirname(workspacePath));
}

/**
 * Resolve the run base directory (.sea/runs/) from a workspace config path.
 */
export function resolveRunBaseDir(workspacePath: string): string {
  return path.join(path.dirname(workspacePath), 'runs');
}

/**
 * Resolve a specific run directory (.sea/runs/<runId>).
 */
export function resolveRunDir(workspacePath: string, runId: string): string {
  return path.join(resolveRunBaseDir(workspacePath), runId);
}

/**
 * Resolve a component's absolute path from workspace state and config.
 *
 * @param workspaceRoot - The workspace root directory (parent of .sea/)
 * @param componentPath - The component path from workspace config (may be relative)
 * @returns Absolute path to the component
 */
export function resolveComponentPath(
  workspaceRoot: string,
  componentPath: string
): string {
  if (path.isAbsolute(componentPath)) {
    return componentPath;
  }
  return path.resolve(workspaceRoot, componentPath);
}

/**
 * Resolve the workspace root from WorkspaceState.
 * Falls back to process.cwd() if state.baseDir is not set.
 */
export function getWorkspaceRoot(state: WorkspaceState): string {
  if (state.baseDir) {
    // baseDir is the .sea directory; workspace root is its parent
    return path.resolve(state.baseDir, '..');
  }
  return process.cwd();
}

/**
 * Resolve a component's absolute path using workspace state.
 * This is the primary entry point for all component path resolution.
 */
export function resolveComponentPathFromState(
  state: WorkspaceState,
  componentConfig: ComponentConfig | { path: string }
): string {
  const workspaceRoot = getWorkspaceRoot(state);
  return resolveComponentPath(workspaceRoot, componentConfig.path);
}

/**
 * Resolve an artifact path relative to a component's resolved path.
 */
export function resolveArtifactPath(
  componentPath: string,
  outputPath?: string
): string {
  if (!outputPath) {
    return componentPath;
  }
  if (path.isAbsolute(outputPath)) {
    return outputPath;
  }
  return path.resolve(componentPath, outputPath);
}

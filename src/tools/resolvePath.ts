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
import * as fs from 'fs';
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
 *
 * Uses state.baseDir (the .sea directory) to derive the workspace root.
 * If baseDir is missing, falls back to process.cwd() only if
 * .sea/workspace.json exists there — otherwise throws.
 */
export function getWorkspaceRoot(state: WorkspaceState): string {
  if (state.baseDir) {
    // baseDir is the .sea directory; workspace root is its parent
    return path.resolve(state.baseDir, '..');
  }
  // Fallback: use process.cwd() only if it looks like a valid workspace
  if (fs.existsSync(path.join(process.cwd(), '.sea', 'workspace.json'))) {
    return process.cwd();
  }
  throw new Error(
    'Cannot resolve workspace root: state.baseDir is not set and no .sea/workspace.json found in cwd. ' +
    'Ensure the run was created with a valid workspace path.'
  );
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

// ---------------------------------------------------------------------------
// outputGlob resolution with mtime-based newest-file selection
// ---------------------------------------------------------------------------

export interface GlobMatchInfo {
  /** Absolute directory the glob was resolved against */
  globDir: string;
  /** Original glob pattern string */
  globPattern: string;
  /** All matching file paths (files only, not directories) */
  allMatches: string[];
  /** The selected artifact path (newest by mtime) */
  selectedPath: string | null;
  /** Why this file was selected (or why none was) */
  reason: string;
}

/**
 * Resolve an outputGlob pattern against a component path.
 *
 * Supports simple glob patterns like `target/*.war`, `build/libs/*.jar`, `output/*.war`.
 * If multiple files match, the newest file (by mtime) is selected.
 * Only files (not directories) are considered.
 *
 * @param componentPath - Absolute path to the component directory
 * @param outputGlob - Glob pattern relative to componentPath (e.g. "output/*.war")
 * @returns GlobMatchInfo with all matches and selected file
 */
export async function resolveOutputGlob(
  componentPath: string,
  outputGlob: string
): Promise<GlobMatchInfo> {
  const globAbsolute = path.resolve(componentPath, outputGlob);
  const globDir = path.dirname(globAbsolute);
  const globBasename = path.basename(globAbsolute);

  // Convert simple glob * to regex
  // Supports patterns like: *.war, app-*.jar, build-?.zip
  const regexStr = globBasename
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexStr}$`);

  const fs = await import('fs/promises');

  let entries: string[];
  try {
    entries = await fs.readdir(globDir);
  } catch {
    return {
      globDir,
      globPattern: outputGlob,
      allMatches: [],
      selectedPath: null,
      reason: `Directory does not exist: ${globDir}`,
    };
  }

  // Filter to regex matches, then to files only (not directories)
  const candidates: string[] = [];
  for (const entry of entries) {
    if (!regex.test(entry)) continue;
    const fullPath = path.join(globDir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        candidates.push(fullPath);
      }
    } catch {
      // skip unreadable entries
    }
  }

  if (candidates.length === 0) {
    return {
      globDir,
      globPattern: outputGlob,
      allMatches: [],
      selectedPath: null,
      reason: `No files matching "${outputGlob}" found in ${globDir}`,
    };
  }

  if (candidates.length === 1) {
    return {
      globDir,
      globPattern: outputGlob,
      allMatches: candidates,
      selectedPath: candidates[0],
      reason: `Single match: ${path.basename(candidates[0])}`,
    };
  }

  // Multiple matches: sort by mtime descending, pick newest
  const withMtime = await Promise.all(
    candidates.map(async (p) => {
      const stat = await fs.stat(p);
      return { path: p, mtime: stat.mtimeMs };
    })
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);

  const selected = withMtime[0];
  const allNames = withMtime.map(m => path.basename(m.path)).join(', ');

  return {
    globDir,
    globPattern: outputGlob,
    allMatches: withMtime.map(m => m.path),
    selectedPath: selected.path,
    reason: `Selected newest of ${candidates.length} matches: ${path.basename(selected.path)} (${allNames})`,
  };
}

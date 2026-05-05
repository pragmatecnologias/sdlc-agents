/**
 * Workspace Service for SEA
 *
 * Handles workspace detection, loading, and path resolution.
 * Used by both CLI commands and interactive UI.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceConfig } from '../state/workspaceState.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('WorkspaceService');

/**
 * Result of workspace detection
 */
export interface WorkspaceDetection {
  found: boolean;
  workspacePath: string | null;  // path to .sea/workspace.json
  workspaceRoot: string | null;  // parent of .sea/
  workspaceName: string | null;
  searchPath: string;  // where we searched from
}

/**
 * Recent run summary
 */
export interface RunSummary {
  runId: string;
  runStatus: string;
  userRequest: string;
  updatedAt: string;
  createdAt: string;
}

/**
 * Find workspace.json by searching upward from cwd
 */
export async function findWorkspaceFromCwd(cwd: string): Promise<WorkspaceDetection> {
  let current = path.resolve(cwd);

  // Search upward for .sea/workspace.json (max 10 levels)
  for (let i = 0; i < 10; i++) {
    const seaDir = path.join(current, '.sea');
    const workspacePath = path.join(seaDir, 'workspace.json');

    try {
      await fs.access(workspacePath);
      // Found it
      const raw = await fs.readFile(workspacePath, 'utf-8');
      const config = JSON.parse(raw) as WorkspaceConfig;

      return {
        found: true,
        workspacePath,
        workspaceRoot: current,
        workspaceName: config.workspaceName || path.basename(current),
        searchPath: cwd,
      };
    } catch {
      // Not found here, go up
      const parent = path.dirname(current);
      if (parent === current) break; // Reached root
      current = parent;
    }
  }

  return {
    found: false,
    workspacePath: null,
    workspaceRoot: null,
    workspaceName: null,
    searchPath: cwd,
  };
}

/**
 * Load workspace config from path
 */
export async function loadWorkspace(workspacePath: string): Promise<{
  config: WorkspaceConfig;
  workspaceRoot: string;
}> {
  const raw = await fs.readFile(path.resolve(workspacePath), 'utf-8');
  const config = JSON.parse(raw) as WorkspaceConfig;
  const workspaceRoot = path.dirname(path.dirname(workspacePath)); // .sea/ -> parent

  return { config, workspaceRoot };
}

/**
 * Resolve workspace path to absolute .sea/workspace.json path
 */
export function resolveWorkspacePath(input: string): string {
  const resolved = path.resolve(input);

  // If input is already a workspace.json file, use it
  if (path.basename(resolved) === 'workspace.json') {
    return resolved;
  }

  // If input is .sea directory, append workspace.json
  if (path.basename(resolved) === '.sea') {
    return path.join(resolved, 'workspace.json');
  }

  // Otherwise treat as workspace root
  return path.join(resolved, '.sea', 'workspace.json');
}

/**
 * List recent runs from .sea/runs/
 */
export async function listRecentRuns(workspacePath: string, limit = 10): Promise<RunSummary[]> {
  const runsDir = path.join(path.dirname(workspacePath), 'runs');

  let runs: RunSummary[] = [];

  try {
    const entries = await fs.readdir(runsDir);

    for (const runId of entries) {
      const statePath = path.join(runsDir, runId, 'state.json');
      try {
        const raw = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(raw);

        runs.push({
          runId,
          runStatus: state.runStatus || 'unknown',
          userRequest: state.userRequest || '',
          updatedAt: state.updatedAt || '',
          createdAt: state.createdAt || '',
        });
      } catch {
        // Skip runs with unreadable state
      }
    }
  } catch {
    // No runs directory yet
    return [];
  }

  // Sort by updatedAt descending
  runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return runs.slice(0, limit);
}

/**
 * Get a specific run's state
 */
export async function getRunState(runId: string, workspacePath: string): Promise<{
  state: Record<string, unknown>;
  runDir: string;
} | null> {
  const runDir = path.join(path.dirname(workspacePath), 'runs', runId);
  const statePath = path.join(runDir, 'state.json');

  try {
    const raw = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(raw);
    return { state, runDir };
  } catch {
    return null;
  }
}

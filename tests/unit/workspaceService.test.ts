/**
 * Tests for WorkspaceService — the backend for interactive mode.
 *
 * Tests workspace detection, loading, run listing, and run state retrieval
 * without requiring interactive prompts (stdin).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  findWorkspaceFromCwd,
  loadWorkspace,
  resolveWorkspacePath,
  listRecentRuns,
  getRunState,
} from '../../src/services/workspaceService.js';

describe('resolveWorkspacePath', () => {
  it('returns input directly if it is already workspace.json', () => {
    const result = resolveWorkspacePath('/project/.sea/workspace.json');
    expect(result).toBe('/project/.sea/workspace.json');
  });

  it('appends workspace.json if input is .sea directory', () => {
    const result = resolveWorkspacePath('/project/.sea');
    expect(result).toBe('/project/.sea/workspace.json');
  });

  it('appends .sea/workspace.json for a plain directory', () => {
    const result = resolveWorkspacePath('/project');
    expect(result).toBe('/project/.sea/workspace.json');
  });
});

describe('findWorkspaceFromCwd', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-ws-detect-'));
    fs.mkdirSync(path.join(tmpDir, '.sea'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.sea', 'workspace.json'),
      JSON.stringify({ workspaceName: 'test-workspace', defaultExecutor: 'manual' }),
      'utf-8'
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds workspace when cwd is the workspace root', async () => {
    const result = await findWorkspaceFromCwd(tmpDir);
    expect(result.found).toBe(true);
    expect(result.workspaceName).toBe('test-workspace');
    expect(result.workspaceRoot).toBe(tmpDir);
  });

  it('finds workspace when cwd is inside the workspace', async () => {
    const subDir = path.join(tmpDir, 'src', 'components');
    fs.mkdirSync(subDir, { recursive: true });
    const result = await findWorkspaceFromCwd(subDir);
    expect(result.found).toBe(true);
    expect(result.workspaceRoot).toBe(tmpDir);
  });

  it('returns not found when no workspace exists', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-ws-empty-'));
    const result = await findWorkspaceFromCwd(emptyDir);
    expect(result.found).toBe(false);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });
});

describe('loadWorkspace', () => {
  it('loads workspace config from workspace.json path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-ws-load-'));
    fs.mkdirSync(path.join(tmpDir, '.sea'), { recursive: true });
    const config = { workspaceName: 'loaded-workspace', defaultExecutor: 'manual' };
    fs.writeFileSync(
      path.join(tmpDir, '.sea', 'workspace.json'),
      JSON.stringify(config),
      'utf-8'
    );

    const result = await loadWorkspace(path.join(tmpDir, '.sea', 'workspace.json'));
    expect(result.config.workspaceName).toBe('loaded-workspace');
    expect(result.workspaceRoot).toBe(tmpDir);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('listRecentRuns and getRunState', () => {
  let tmpDir: string;
  let workspacePath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-ws-runs-'));
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
    fs.mkdirSync(path.join(tmpDir, '.sea', 'runs', 'run-100'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.sea', 'runs', 'run-200'), { recursive: true });

    // Write state files
    const state100 = {
      runId: 'run-100',
      runStatus: 'completed',
      userRequest: 'First task',
      updatedAt: '2026-01-02T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const state200 = {
      runId: 'run-200',
      runStatus: 'awaiting_manual_execution',
      userRequest: 'Second task',
      updatedAt: '2026-01-03T00:00:00Z',
      createdAt: '2026-01-02T00:00:00Z',
    };
    fs.writeFileSync(
      path.join(tmpDir, '.sea', 'runs', 'run-100', 'state.json'),
      JSON.stringify(state100),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.sea', 'runs', 'run-200', 'state.json'),
      JSON.stringify(state200),
      'utf-8'
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists runs sorted by updatedAt descending', async () => {
    const runs = await listRecentRuns(workspacePath);
    expect(runs.length).toBe(2);
    // run-200 has later updatedAt
    expect(runs[0].runId).toBe('run-200');
    expect(runs[1].runId).toBe('run-100');
  });

  it('respects limit parameter', async () => {
    const runs = await listRecentRuns(workspacePath, 1);
    expect(runs.length).toBe(1);
    expect(runs[0].runId).toBe('run-200');
  });

  it('getRunState returns run state and runDir', async () => {
    const result = await getRunState('run-100', workspacePath);
    expect(result).not.toBeNull();
    expect(result!.state.runId).toBe('run-100');
    expect(result!.state.userRequest).toBe('First task');
    expect(result!.runDir).toContain('run-100');
  });

  it('getRunState returns null for non-existent run', async () => {
    const result = await getRunState('run-nonexistent', workspacePath);
    expect(result).toBeNull();
  });
});

describe('workspace detection with war-composite fixture', () => {
  it('finds workspace from fixture root', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/war-composite');
    const result = await findWorkspaceFromCwd(fixtureDir);
    expect(result.found).toBe(true);
    expect(result.workspaceName).toBe('war-composite-app');
  });

  it('lists runs from war-composite fixture', async () => {
    const workspacePath = path.resolve(__dirname, '../fixtures/war-composite/.sea/workspace.json');
    const runs = await listRecentRuns(workspacePath);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.some(r => r.runId.startsWith('run-'))).toBe(true);
  });

  it('gets run state from war-composite fixture', async () => {
    const workspacePath = path.resolve(__dirname, '../fixtures/war-composite/.sea/workspace.json');
    const runs = await listRecentRuns(workspacePath, 1);
    const runId = runs[0].runId;

    const result = await getRunState(runId, workspacePath);
    expect(result).not.toBeNull();
    expect(result!.state.runId).toBe(runId);
    expect(result!.state.componentStates).toBeDefined();
  });
});

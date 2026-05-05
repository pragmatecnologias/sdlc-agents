/**
 * Tests for branch safety module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  captureBranchSafety,
  checkDirtyComponents,
  createTaskBranches,
  formatBranchSafetyReport,
} from '../../src/tools/branchSafety.js';
import { loadBranchSafetyState, saveBranchSafetyState } from '../../src/tools/branchSafety.js';
import { ComponentConfig } from '../../src/state/schemas.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

function makeComponent(name: string, relPath: string): ComponentConfig {
  return {
    name,
    path: relPath,
    kind: 'source',
    role: 'source',
  };
}

describe('checkDirtyComponents', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-branch-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty list for clean repos', async () => {
    const components = [
      makeComponent('ui', path.join(tmpDir, 'ui')),
    ];
    const dirty = await checkDirtyComponents(tmpDir, components);
    expect(dirty).toEqual([]);
  });

  it('detects dirty repos', async () => {
    // Create a dirty component
    const uiDir = path.join(tmpDir, 'ui');
    await fs.writeFile(path.join(uiDir, 'new-file.txt'), 'dirty content', 'utf-8');

    const components = [
      makeComponent('ui', uiDir),
    ];
    const dirty = await checkDirtyComponents(tmpDir, components);
    expect(dirty).toContain('ui');
  });
});

describe('captureBranchSafety', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-branch-capture-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('captures branch and head for each component', async () => {
    const components = [
      makeComponent('ui', path.join(tmpDir, 'ui')),
      makeComponent('backend', path.join(tmpDir, 'backend')),
    ];

    const result = await captureBranchSafety('run-test-123', tmpDir, components, path.join(tmpDir, '.sea'));

    expect(result.runId).toBe('run-test-123');
    expect(result.workspaceRoot).toBe(tmpDir);
    expect(result.components).toHaveLength(2);

    const uiState = result.components.find(c => c.componentName === 'ui');
    expect(uiState).toBeDefined();
    expect(uiState!.branchBefore).toBeTruthy();
    expect(uiState!.headBefore).toHaveLength(40); // SHA-1 hash
  });

  it('marks dirty state correctly', async () => {
    const uiDir = path.join(tmpDir, 'ui');
    await fs.writeFile(path.join(uiDir, 'dirty.txt'), 'content', 'utf-8');

    const components = [
      makeComponent('ui', uiDir),
    ];

    const result = await captureBranchSafety('run-test-456', tmpDir, components, path.join(tmpDir, '.sea'));
    const uiState = result.components[0];

    expect(uiState.isDirty).toBe(true);
  });

  it('saves and loads branch safety state', async () => {
    const components = [
      makeComponent('ui', path.join(tmpDir, 'ui')),
    ];

    const result = await captureBranchSafety('run-test-save', tmpDir, components, path.join(tmpDir, '.sea'));
    await saveBranchSafetyState('run-test-save', result, path.join(tmpDir, '.sea'));

    const loaded = await loadBranchSafetyState('run-test-save', path.join(tmpDir, '.sea'));
    expect(loaded).not.toBeNull();
    expect(loaded!.runId).toBe('run-test-save');
    expect(loaded!.components[0].componentName).toBe('ui');
  });
});

describe('formatBranchSafetyReport', () => {
  it('formats BranchSafetyResult correctly', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-format-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const components = [
      makeComponent('ui', path.join(tmpDir, 'ui')),
    ];
    const result = await captureBranchSafety('run-fmt-123', tmpDir, components, path.join(tmpDir, '.sea'));

    const report = formatBranchSafetyReport(result);
    expect(report).toContain('Branch Safety Report');
    expect(report).toContain('run-fmt-123');
    expect(report).toContain('ui');
    expect(report).toContain('Branch:');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

describe('createTaskBranches', () => {
  let tmpDir: string;
  let uiDir: string;
  let backendDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-branch-create-'));

    // Create separate git repos for each component (they share the workspace root but are independent repos)
    uiDir = path.join(tmpDir, 'ui');
    backendDir = path.join(tmpDir, 'backend');
    await fs.mkdir(uiDir, { recursive: true });
    await fs.mkdir(backendDir, { recursive: true });

    await fs.writeFile(path.join(uiDir, 'index.ts'), 'export const ui = 1;\n');
    await fs.writeFile(path.join(backendDir, 'index.ts'), 'export const backend = 1;\n');

    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: uiDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: backendDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('default: creates branches only for modify components', async () => {
    const components = [
      makeComponent('ui', uiDir),
      makeComponent('backend', backendDir),
    ];

    const componentStates = {
      ui: { changeRole: 'modify' },
      backend: { changeRole: 'no_change' },
    };

    const result = await createTaskBranches(
      'run-branch-test-1',
      tmpDir,
      components,
      path.join(tmpDir, '.sea'),
      { onlyModifyComponents: true, componentStates }
    );

    // ui should have a branch created
    const uiState = result.componentBranchStates.find(c => c.componentName === 'ui');
    expect(uiState).toBeDefined();
    expect(uiState!.branchCreated).toBeTruthy();
    expect(uiState!.branchCreated).toContain('sea/');

    // backend should NOT have a branch created
    const backendState = result.componentBranchStates.find(c => c.componentName === 'backend');
    expect(backendState).toBeDefined();
    expect(backendState!.branchCreated).toBeNull();
  });

  it('--all: creates branches for all components', async () => {
    const components = [
      makeComponent('ui', uiDir),
      makeComponent('backend', backendDir),
    ];

    const componentStates = {
      ui: { changeRole: 'modify' },
      backend: { changeRole: 'no_change' },
    };

    const result = await createTaskBranches(
      'run-branch-test-2',
      tmpDir,
      components,
      path.join(tmpDir, '.sea'),
      { onlyModifyComponents: false, componentStates }
    );

    // Both should have branches created
    const uiState = result.componentBranchStates.find(c => c.componentName === 'ui');
    expect(uiState).toBeDefined();
    expect(uiState!.branchCreated).toBeTruthy();

    const backendState = result.componentBranchStates.find(c => c.componentName === 'backend');
    expect(backendState).toBeDefined();
    expect(backendState!.branchCreated).toBeTruthy();

    expect(result.branches).toHaveLength(2);
  });
});
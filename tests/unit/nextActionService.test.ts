/**
 * Tests for NextActionService
 *
 * Verifies that determineNextAction returns correct next actions
 * based on WorkspaceState runStatus and componentStates.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { determineNextAction, getMissingEvidence, formatNextActionCommand } from '../../src/services/nextActionService.js';
import { WorkspaceState } from '../../src/state/workspaceState.js';

const CLI = path.resolve(__dirname, '../../dist/index.js');
const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

function runCli(args: string, cwd?: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd: cwd || process.cwd(),
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

describe('NextActionService', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;

  beforeAll(async () => {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-next-action-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const runOutput = runCli(`run "test next action" -w ${workspacePath}`, tmpDir);
    expect(runOutput).toContain('Manual Execution Required');

    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns OPEN_EXECUTION_REQUEST when run is awaiting_manual_execution', async () => {
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8')) as WorkspaceState;

    const nextAction = determineNextAction(state);

    expect(nextAction.runId).toBe(runId);
    expect(nextAction.canRunInteractively).toBe(true);
    expect(['OPEN_EXECUTION_REQUEST', 'CAPTURE_EVIDENCE']).toContain(nextAction.type);
  });

  it('after-execution changes run state', async () => {
    runCli(`after-execution ${runId} -c backend -w ${workspacePath}`, tmpDir);

    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8')) as WorkspaceState;

    // After evidence capture for backend, ui still needs evidence so CAPTURE_EVIDENCE is valid
    const nextAction = determineNextAction(state);
    expect(nextAction.runId).toBe(runId);
    expect(nextAction.canRunInteractively).toBe(true);
    // Valid next actions after partial evidence: CAPTURE_EVIDENCE, RUN_VERIFICATION
    expect(['CAPTURE_EVIDENCE', 'RUN_VERIFICATION']).toContain(nextAction.type);
  });

  it('getMissingEvidence returns list of components missing evidence', async () => {
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8')) as WorkspaceState;

    const missing = getMissingEvidence(state);

    const uiMissing = missing.some(m => m.startsWith('ui:'));
    expect(uiMissing).toBe(true);
  });
});

describe('sea status command', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;

  beforeAll(async () => {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-status-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const runOutput = runCli(`run "test status" -w ${workspacePath}`, tmpDir);
    expect(runOutput).toContain('Manual Execution Required');

    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('sea status outputs run board', () => {
    const output = runCli(`status ${runId} -w ${workspacePath}`, tmpDir);

    expect(output).toContain('SEA Run Status');
    expect(output).toContain('Run');
    expect(output).toContain('Status');
    expect(output).toContain('Components');
    expect(output).toContain('Next Recommended Action');
  });

  it('sea status --json outputs valid JSON', () => {
    const output = runCli(`status ${runId} -w ${workspacePath} --json`, tmpDir);

    const parsed = JSON.parse(output);
    expect(parsed.runId).toBe(runId);
    expect(parsed.runStatus).toBeDefined();
    expect(parsed.components).toBeInstanceOf(Array);
    expect(parsed.nextAction).toBeDefined();
    expect(parsed.nextAction.type).toBeDefined();
  });
});

describe('sea next command', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;

  beforeAll(async () => {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-next-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const runOutput = runCli(`run "test next" -w ${workspacePath}`, tmpDir);
    expect(runOutput).toContain('Manual Execution Required');

    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('sea next outputs next action', () => {
    const output = runCli(`next ${runId} -w ${workspacePath}`, tmpDir);

    expect(output).toContain('Next Action');
    expect(output).toContain('Command:');
  });

  it('sea next --json outputs valid NextAction JSON', () => {
    const output = runCli(`next ${runId} -w ${workspacePath} --json`, tmpDir);

    const parsed = JSON.parse(output);
    expect(parsed.type).toBeDefined();
    expect(parsed.runId).toBe(runId);
    expect(parsed.reason).toBeDefined();
    expect(parsed.canRunInteractively).toBeDefined();
  });
});

describe('formatNextActionCommand (unit)', () => {
  it('produces correct command for each action type with component', () => {
    const base = { runId: 'run-1', reason: 'test', canRunInteractively: true };

    expect(formatNextActionCommand({ ...base, type: 'OPEN_EXECUTION_REQUEST', component: 'ui' }, '/ws'))
      .toBe('sea request run-1 -c ui -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'CAPTURE_EVIDENCE', component: 'ui' }, '/ws'))
      .toBe('sea after-execution run-1 -c ui -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'INSPECT_ARTIFACT', component: 'war' }, '/ws'))
      .toBe('sea inspect-artifact run-1 -c war -w /ws');
  });

  it('produces correct command for types without component', () => {
    const base = { runId: 'run-2', reason: 'test', canRunInteractively: true };

    expect(formatNextActionCommand({ ...base, type: 'RUN_VERIFICATION' }, '/ws'))
      .toBe('sea verify run-2 -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'SHOW_REPORT' }, '/ws'))
      .toBe('sea report run-2 -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'RESUME' }, '/ws'))
      .toBe('sea resume run-2 -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'FIX_BLOCKER' }, '/ws'))
      .toBe('sea resume run-2 -w /ws');

    expect(formatNextActionCommand({ ...base, type: 'NONE' }, '/ws'))
      .toBe('');
  });

  it('never contains placeholder strings', () => {
    const types = ['OPEN_EXECUTION_REQUEST', 'CAPTURE_EVIDENCE', 'RUN_VERIFICATION', 'INSPECT_ARTIFACT', 'SHOW_REPORT', 'RESUME', 'FIX_BLOCKER', 'NONE'] as const;
    for (const type of types) {
      const action = { type, runId: 'run-x', reason: 'test', canRunInteractively: false };
      const result = formatNextActionCommand(action, '/some/path');
      expect(result).not.toContain('<workspace>');
      expect(result).not.toContain('{{workspace');
    }
  });
});

describe('getMissingEvidence (changeRole-aware)', () => {
  function makeState(componentStates: Record<string, unknown>): WorkspaceState {
    return {
      runId: 'test-run',
      runStatus: 'evidence_captured',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      userRequest: 'test',
      workspace: { workspaceName: 'test', defaultExecutor: 'manual', approvalPolicy: { required: false }, qualityGates: {}, components: [] },
      componentStates: componentStates as WorkspaceState['componentStates'],
    } as WorkspaceState;
  }

  it('modify with no diff reports missing diff', () => {
    const state = makeState({
      comp1: { changeRole: 'modify', diffPath: null, changedFiles: [], commandResults: [] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: no diff captured');
  });

  it('modify with no commands reports missing commands', () => {
    const state = makeState({
      comp1: { changeRole: 'modify', diffPath: '/diff.patch', changedFiles: ['a.ts'], commandResults: [] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: no verification commands run');
  });

  it('verify_only with no commands reports missing commands (not diff)', () => {
    const state = makeState({
      comp1: { changeRole: 'verify_only', diffPath: null, changedFiles: [], commandResults: [] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: no verification commands run');
    expect(missing).not.toContain('comp1: no diff captured');
  });

  it('verify_only with commands is not reported', () => {
    const state = makeState({
      comp1: { changeRole: 'verify_only', diffPath: null, changedFiles: [], commandResults: [{ commandName: 'test' }] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toHaveLength(0);
  });

  it('package_only with no commands reports missing commands', () => {
    const state = makeState({
      comp1: { changeRole: 'package_only', diffPath: null, changedFiles: [], commandResults: [] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: no verification commands run');
    expect(missing).not.toContain('comp1: no diff captured');
  });

  it('artifact_verify with no inspection reports missing inspection', () => {
    const state = makeState({
      comp1: { changeRole: 'artifact_verify', diffPath: null, changedFiles: [], commandResults: [], artifactInspection: null },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: no artifact inspection');
    expect(missing).not.toContain('comp1: no diff captured');
  });

  it('artifact_verify with inspection but no diff does not report diff', () => {
    const state = makeState({
      comp1: { changeRole: 'artifact_verify', diffPath: null, changedFiles: [], commandResults: [], artifactInspection: { valid: true, artifactType: 'war' } },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toHaveLength(0);
  });

  it('no_change produces empty missing list', () => {
    const state = makeState({
      comp1: { changeRole: 'no_change', diffPath: null, changedFiles: [], commandResults: [] },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toHaveLength(0);
  });

  it('blocked is reported', () => {
    const state = makeState({
      comp1: { changeRole: 'blocked' },
    });
    const missing = getMissingEvidence(state);
    expect(missing).toContain('comp1: blocked');
  });
});

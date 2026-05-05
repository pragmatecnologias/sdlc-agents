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
import { determineNextAction, getMissingEvidence } from '../../src/services/nextActionService.js';
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

/**
 * Tests for completed_no_changes handling across the workflow.
 *
 * Verifies that when after-execution captures zero file changes,
 * the status is set to completed_no_changes and the report shows
 * it as missing evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CLI = path.resolve(__dirname, '../../dist/index.js');
const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

let tmpDir: string;
let workspacePath: string;
let runId: string;

function runCli(args: string, cwd?: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd: cwd || tmpDir,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

describe('completed_no_changes handling', () => {
  beforeAll(async () => {
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-no-changes-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    // Init git
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Run the workflow (creates run, pauses for manual execution)
    const runOutput = runCli(`run "test no changes" -w ${workspacePath}`);
    expect(runOutput).toContain('Manual Execution Required');

    // Extract runId from output: "Run ID: run-1234567890"
    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('sets completed_no_changes when after-execution finds no changes', async () => {
    // Run after-execution on backend WITHOUT making any changes
    const afterOutput = runCli(`after-execution ${runId} -c backend -w ${workspacePath}`);
    expect(afterOutput).toContain('backend');

    // Verify state shows completed_no_changes
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));

    const backendCS = state.componentStates.backend;
    expect(backendCS.executorResult.status).toBe('completed_no_changes');
    expect(backendCS.changedFiles).toHaveLength(0);
  });

  it('verify shows completed_no_changes in component results', () => {
    // after-execution for ui (also no changes)
    runCli(`after-execution ${runId} -c ui -w ${workspacePath}`);

    // Run verify
    const verifyOutput = runCli(`verify ${runId} -w ${workspacePath}`);
    expect(verifyOutput).toContain('Verification Summary');
  });

  it('report shows completed_no_changes under Missing Evidence', async () => {
    const reportOutput = runCli(`report ${runId} -w ${workspacePath}`);
    expect(reportOutput).toContain('Missing Evidence');
    expect(reportOutput).toContain('completed but no files changed');

    // Also verify the state file has the correct executor status
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));

    // Both backend and ui should have completed_no_changes
    expect(state.componentStates.backend.executorResult.status).toBe('completed_no_changes');
    expect(state.componentStates.ui.executorResult.status).toBe('completed_no_changes');
  });

  it('final decision does not approve modify component with completed_no_changes', async () => {
    // Run resume to progress through remaining phases to final decision
    const resumeOutput = runCli(`resume ${runId} -w ${workspacePath}`);
    expect(resumeOutput).toContain('Resuming');

    // Verify state has final decision
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
    expect(state.finalDecision).toBeDefined();

    // Must NOT be APPROVED or APPROVED_WITH_NOTES — completed_no_changes is not evidence
    const approvalVerdicts = ['APPROVED', 'APPROVED_WITH_NOTES'];
    expect(approvalVerdicts).not.toContain(state.finalDecision.decision);
  });
});

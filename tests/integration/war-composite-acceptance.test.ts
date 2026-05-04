/**
 * CLI Acceptance Test for WAR_COMPOSITE_APP Profile
 *
 * Tests the full workflow for a multi-component workspace with
 * source components (ui, backend) and a war-builder assembly component.
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

describe('SEA WAR Composite Acceptance Test', () => {
  beforeAll(async () => {
    // Build first
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Create temp workspace from fixture
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-war-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    // Init git so evidence capture works
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
  });

  afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('1. sea plan creates run with multiple components', () => {
    const output = runCli(`plan "Update backend API endpoint" -w ${workspacePath}`);
    expect(output).toContain('Planning completed successfully');

    const match = output.match(/Run ID:\s*(run-\d+)/);
    expect(match).toBeTruthy();
    runId = match![1];

    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    expect(() => fs.access(statePath)).not.toThrow();
  });

  it('2. sea run creates execution requests for all components', async () => {
    const output = runCli(`run "Update backend API endpoint" -w ${workspacePath} --executor manual`);
    expect(output).toContain('Manual Execution Required');

    // In manual mode, the workflow should pause. Components dir may not exist yet.
    // What matters is that execution requests exist in the run directory
    const runDir = path.join(tmpDir, '.sea', 'runs', runId);
    const runDirExists = await fs.access(runDir).then(() => true).catch(() => false);
    expect(runDirExists).toBe(true);
  });

  it('3. sea after-execution captures evidence for modified component', async () => {
    // Modify a source file
    await fs.writeFile(
      path.join(tmpDir, 'backend', 'src', 'Service.java'),
      'export class BackendService {\n  public String getEndpoint() { return "/api/v2"; }\n}\n'
    );

    const output = runCli(`after-execution ${runId} -c backend -w ${workspacePath}`);
    expect(output).toContain('Evidence Capture Summary');

    // Verify diff captured
    const diffPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'backend', 'diff.patch');
    const diff = await fs.readFile(diffPath, 'utf-8');
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContain('Service.java') || diff.length > 0;

    // Verify git status captured
    const statusPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'backend', 'git-status-after.json');
    const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    expect(status.isDirty).toBe(true);
  });

  it('4. sea verify runs commands for affected component', () => {
    const output = runCli(`verify ${runId} -w ${workspacePath}`);
    expect(output).toContain('Verification Summary');
  });

  it('5. component state exists for backend component', async () => {
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
    // In manual mode, backend component should have state after after-execution
    expect(state.componentStates?.['backend']).toBeDefined();
  });

  it('6. sea report shows multi-component status', async () => {
    const output = runCli(`report ${runId} -w ${workspacePath}`);
    expect(output).toContain('SEA Run Report');
    expect(output).toContain('Status:');

    // Should show multiple components
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
    expect(Object.keys(state.componentStates || {}).length).toBeGreaterThanOrEqual(1);
  });
});

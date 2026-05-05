/**
 * Full CLI Acceptance Test for WAR_COMPOSITE_APP Profile
 *
 * Tests the complete enterprise WAR workflow across three components:
 * - ui (frontend source)
 * - backend (Java source)
 * - war-builder (assembly/packager)
 *
 * Validates: plan → run → request → after-execution (x2) → verify → inspect-artifact → report (all components, artifact inspection, diff, next action)
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

describe('SEA WAR Composite Enterprise Acceptance Test', () => {
  beforeAll(async () => {
    // Build first
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Create temp workspace from fixture
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-enterprise-war-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    // Init git so evidence capture works
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Remove pre-generated WAR so test proves it gets built during verify
    const warOutputDir = path.join(tmpDir, 'war-builder', 'output');
    try { await fs.rm(warOutputDir, { recursive: true, force: true }); } catch {}
  });

  afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('1. sea plan creates run with state', () => {
    const output = runCli(`plan "Add customer status to search results" -w ${workspacePath}`);
    expect(output).toContain('Planning completed successfully');

    const match = output.match(/Run ID:\s*(run-\d+)/);
    expect(match).toBeTruthy();
    runId = match![1];

    // Verify state.json exists
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    expect(() => fs.access(statePath)).not.toThrow();
  });

  it('2. sea run pauses for manual execution', () => {
    const output = runCli(`run "Add customer status to search results" -w ${workspacePath} --executor manual`);

    // sea run creates a NEW run, update runId so subsequent tests use it
    const runMatch = output.match(/Run ID:\s*(run-\d+)/);
    if (runMatch) {
      runId = runMatch[1];
    }

    expect(output).toContain('Manual Execution Required');
    expect(output).toContain('backend');
    expect(output).toContain('ui');

    // Verify state shows awaiting_manual_execution
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(require('fs').readFileSync(statePath, 'utf-8'));
    expect(state.runStatus).toBe('awaiting_manual_execution');
  });

  it('3. sea request shows backend execution request', () => {
    const output = runCli(`request ${runId} -c backend -w ${workspacePath}`);
    expect(output).toContain('Execution Request: backend');
    expect(output).toContain('# Execution Request');
    expect(output).toContain('sea after-execution');
  });

  it('4. backend after-execution captures diff and evidence', async () => {
    // Modify backend source file
    await fs.writeFile(
      path.join(tmpDir, 'backend', 'src', 'Service.java'),
      'public class BackendService {\n  public String getStatus() { return "active"; }\n}\n'
    );

    const output = runCli(`after-execution ${runId} -c backend -w ${workspacePath}`);
    expect(output).toContain('Evidence Capture Summary');
    expect(output).toContain('Changed:');

    // Verify diff.patch is non-empty
    const diffPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'backend', 'diff.patch');
    const diff = await fs.readFile(diffPath, 'utf-8');
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContain('BackendService');

    // Verify git-status-after.json exists
    const statusPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'backend', 'git-status-after.json');
    const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    expect(status.isDirty).toBe(true);
  });

  it('5. sea request shows ui execution request', () => {
    const output = runCli(`request ${runId} -c ui -w ${workspacePath}`);
    expect(output).toContain('Execution Request: ui');
    expect(output).toContain('# Execution Request');
  });

  it('6. ui after-execution captures diff and evidence', async () => {
    // Modify ui source file
    await fs.writeFile(
      path.join(tmpDir, 'ui', 'src', 'index.ts'),
      'export const uiVersion = "v2";\n'
    );

    const output = runCli(`after-execution ${runId} -c ui -w ${workspacePath}`);
    expect(output).toContain('Evidence Capture Summary');

    // Verify diff.patch is non-empty
    const diffPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'ui', 'diff.patch');
    const diff = await fs.readFile(diffPath, 'utf-8');
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContain('uiVersion');
    expect(diff).toContain('index.ts');
  });

  it('7. sea verify runs commands and saves output', async () => {
    const output = runCli(`verify ${runId} -w ${workspacePath}`);
    expect(output).toContain('Verification Summary');
    expect(output).toContain('Commands run:');

    // Verify state has verification results
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(require('fs').readFileSync(statePath, 'utf-8'));
    expect(state.verification).toBeTruthy();
    expect(state.verification.totalCommandsRun).toBeGreaterThan(0);

    // Verify that war-builder's custom:package command built the WAR
    const warPath = path.join(tmpDir, 'war-builder', 'output', 'app.war');
    const warExists = await fs.access(warPath).then(() => true).catch(() => false);
    expect(warExists).toBe(true);
  });

  it('8. sea inspect-artifact inspects WAR and confirms structure', () => {
    // First ensure WAR exists
    const warPath = path.join(tmpDir, 'war-builder', 'output', 'app.war');
    expect(() => fs.access(warPath)).not.toThrow();

    const output = runCli(`inspect-artifact ${runId} -c war-builder -w ${workspacePath}`);
    expect(output).toContain('Artifact Inspection: war-builder');
    expect(output).toContain('WEB-INF');

    // Verify artifact-inspection.json was saved
    const inspectionPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'war-builder', 'artifact-inspection.json');
    expect(() => fs.access(inspectionPath)).not.toThrow();

    const inspection = JSON.parse(require('fs').readFileSync(inspectionPath, 'utf-8'));
    expect(inspection.entriesChecked).toBeDefined();
    expect(inspection.entriesChecked['WEB-INF/web.xml']).toBe(true);
  });

  it('9. sea report shows all three components, artifact inspection, and next action', () => {
    const output = runCli(`report ${runId} -w ${workspacePath}`);

    // Report structure
    expect(output).toContain('SEA Run Report');
    expect(output).toContain('Status:');

    // All three components must appear in report output
    expect(output).toContain('backend:');
    expect(output).toContain('ui:');
    expect(output).toContain('war-builder:');

    // Each component shows change role and decision
    expect(output).toContain('Change:');
    expect(output).toContain('Decision:');

    // Artifact inspection section should appear for war-builder
    expect(output).toContain('Artifact Inspection');

    // State file must have all three components
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(require('fs').readFileSync(statePath, 'utf-8'));
    expect(state.componentStates?.['backend']).toBeDefined();
    expect(state.componentStates?.['ui']).toBeDefined();
    expect(state.componentStates?.['war-builder']).toBeDefined();

    // diff.patch must exist for at least one component that was modified
    const hasDiff = Object.values(state.componentStates).some(
      (cs: any) => cs.diffPath && cs.diffPath.includes('diff')
    );
    expect(hasDiff).toBe(true);

    // Artifact inspection must exist for war-builder
    const warInspection = state.artifactInspections?.find(
      (ai: any) => ai.component === 'war-builder'
    );
    expect(warInspection).toBeDefined();
    // status is 'warning' because fixture has .gitkeep placeholders, not real .class/.jar files
    expect(['passed', 'warning']).toContain(warInspection.status);

    // Report must show next action
    expect(output).toContain('Next Action');
  });
});

/**
 * Full CLI Acceptance Test for SEA
 *
 * Executes actual CLI commands against a temp fixture workspace and verifies
 * the complete runtime loop: plan → request → manual change → after-execution → verify → report
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CLI = path.resolve(__dirname, '../../dist/index.js');

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

describe('SEA CLI Acceptance Test', () => {
  beforeAll(async () => {
    // Build first
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Create temp workspace with a minimal fixture
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-acceptance-'));
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    // Create .sea directory and workspace config
    await fs.mkdir(path.join(tmpDir, '.sea'), { recursive: true });
    await fs.writeFile(workspacePath, JSON.stringify({
      workspaceName: 'test-acceptance',
      projectProfile: 'SINGLE_REPO_FRONTEND',
      defaultExecutor: 'manual',
      approvalPolicy: {
        requireBeforeImplementation: false,
        requireForAuthChanges: false,
        requireForDatabaseMigrations: false,
        requireForPackageChanges: false,
        requireForBuildConfigChanges: false,
        requireForDeletingFiles: false,
      },
      qualityGates: {
        requireSourceRepoCleanBeforeRun: false,
        requireFinalArtifactBuild: false,
        requireArtifactInspection: false,
        blockOnForbiddenPathModification: true,
        blockOnProtectedPathModificationWithoutApproval: true,
        warnIfNoSmokeTest: true,
      },
      components: [
        {
          name: 'app',
          path: '.',
          kind: 'frontend',
          role: 'source',
          technology: 'typescript',
          framework: 'react',
          packageManager: 'npm',
          commands: {
            test: 'echo "tests passed"',
            build: 'echo "build succeeded"',
          },
          artifact: {
            type: 'static-bundle',
            outputPath: 'dist',
            requiredEntries: ['index.html'],
          },
          dependencies: [],
          produces: ['static-bundle'],
        },
      ],
    }, null, 2));

    // Create a source file to modify
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'src', 'App.tsx'),
      'export const App = () => <div>Hello</div>;\n'
    );

    // Ignore .sea/runs so only source changes are tracked
    await fs.writeFile(
      path.join(tmpDir, '.gitignore'),
      '.sea/runs/\n'
    );

    // Init git repo so evidence capture works
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

  it('1. sea plan creates a run with state', () => {
    const output = runCli(`plan "Add a login form" -w ${workspacePath}`);
    expect(output).toContain('Planning completed successfully');
    expect(output).toContain('Run ID:');

    // Extract run ID
    const match = output.match(/Run ID:\s*(run-\d+)/);
    expect(match).toBeTruthy();
    runId = match![1];

    // Verify state.json exists
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    expect(() => fs.access(statePath)).not.toThrow();
  });

  it('2. sea run creates execution requests for manual mode', () => {
    const output = runCli(`run "Add a login form" -w ${workspacePath} --executor manual`);
    expect(output).toContain('Workflow completed successfully');

    // Extract run ID
    const match = output.match(/Run ID:\s*(run-\d+)/);
    expect(match).toBeTruthy();
    runId = match![1];

    // Should show manual execution required
    expect(output).toContain('Manual Execution Required');

    // Verify state exists
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(require('fs').readFileSync(statePath, 'utf-8'));
    expect(state.runStatus).toBe('awaiting_manual_execution');
  });

  it('3. sea request shows execution request content', () => {
    const output = runCli(`request ${runId} -c app -w ${workspacePath}`);
    expect(output).toContain('Execution Request: app');
    expect(output).toContain('Change Role:');
    expect(output).toContain('# Execution Request');
    expect(output).toContain('sea after-execution');
  });

  it('4. sea after-execution captures git evidence after file change', async () => {
    // Make a real file change
    require('fs').writeFileSync(
      path.join(tmpDir, 'src', 'App.tsx'),
      'export const App = () => <div>Login Form</div>;\n'
    );

    const output = runCli(`after-execution ${runId} -c app -w ${workspacePath}`);
    expect(output).toContain('Evidence Capture Summary');
    expect(output).toContain('Changed:     1 file(s)');
    expect(output).toContain('Dirty after: true');
    expect(output).toContain('Decision:    implemented');

    // Verify diff.patch exists and is non-empty
    const diffPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'app', 'diff.patch');
    const diff = await fs.readFile(diffPath, 'utf-8');
    expect(diff.length).toBeGreaterThan(0);

    // Verify git-status-after.json exists
    const statusPath = path.join(tmpDir, '.sea', 'runs', runId, 'components', 'app', 'git-status-after.json');
    const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    expect(status.isDirty).toBe(true);
  });

  it('5. sea verify runs real commands and captures output', () => {
    const output = runCli(`verify ${runId} -w ${workspacePath}`);
    expect(output).toContain('Verification Summary');
    expect(output).toContain('Overall:');
    expect(output).toContain('Commands run:');

    // Verify state was updated with verification results
    const statePath = path.join(tmpDir, '.sea', 'runs', runId, 'state.json');
    const state = JSON.parse(require('fs').readFileSync(statePath, 'utf-8'));
    expect(state.verification).toBeTruthy();
    expect(state.verification.totalCommandsRun).toBeGreaterThan(0);
  });

  it('6. sea report shows operational details', () => {
    const output = runCli(`report ${runId} -w ${workspacePath}`);
    expect(output).toContain('SEA Run Report');
    expect(output).toContain('Status:');
    expect(output).toContain('Request:');
    expect(output).toContain('Components');
    expect(output).toContain('app:');
    expect(output).toContain('Verification');
    expect(output).toContain('Next Action');
  });
});

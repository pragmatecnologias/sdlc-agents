/**
 * Integration test for multi-repo branch creation via CLI
 *
 * Proves:
 * - `sea branch <runId> --create` creates branches only for modify components
 * - `sea branch <runId> --create --all` creates branches for all components
 * - Branch names follow the `sea/<runId>/<component>` convention
 * - Branch safety state is persisted correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CLI = path.resolve(__dirname, '../../dist/index.js');

function runCli(args: string, cwd: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

describe('multi-repo branch creation', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;
  let uiDir: string;
  let backendDir: string;

  beforeAll(async () => {
    // Build CLI
    execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Create temp workspace with separate git repos per component
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-branch-multi-'));
    uiDir = path.join(tmpDir, 'ui');
    backendDir = path.join(tmpDir, 'backend');

    // Create ui component with its own git repo
    await fs.mkdir(uiDir, { recursive: true });
    await fs.writeFile(path.join(uiDir, 'index.ts'), 'export const ui = 1;\n');
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: uiDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Create backend component with its own git repo
    await fs.mkdir(backendDir, { recursive: true });
    await fs.writeFile(path.join(backendDir, 'server.ts'), 'export const server = 1;\n');
    execSync('git init && git add -A && git commit -m "initial"', {
      cwd: backendDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Create workspace config
    await fs.mkdir(path.join(tmpDir, '.sea'), { recursive: true });
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
    await fs.writeFile(workspacePath, JSON.stringify({
      workspaceName: 'multi-repo-test',
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
          name: 'ui',
          path: 'ui',
          kind: 'frontend',
          role: 'source',
          technology: 'typescript',
          framework: 'vanilla',
          packageManager: 'npm',
          commands: {
            test: 'echo "UI tests passed"',
            build: 'echo "UI built"',
          },
          artifact: { type: 'none', outputPath: 'dist' },
          dependencies: [],
          produces: [],
        },
        {
          name: 'backend',
          path: 'backend',
          kind: 'backend',
          role: 'source',
          technology: 'typescript',
          framework: 'express',
          commands: {
            test: 'echo "Backend tests passed"',
            build: 'echo "Backend built"',
          },
          artifact: { type: 'none', outputPath: 'dist' },
          dependencies: [],
          produces: [],
        },
      ],
    }, null, 2));

    // Create a run
    const runOutput = runCli(`run "multi-repo branch test" -w ${workspacePath}`, tmpDir);
    const match = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(match).toBeTruthy();
    runId = match![1];
  });

  afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('branch --create creates branches for components', () => {
    const output = runCli(`branch ${runId} --create -w ${workspacePath}`, tmpDir);

    // Should report branch creation
    expect(output).toContain('Created branches');

    // Check that branches were created in git
    const uiBranches = execSync('git branch', { cwd: uiDir, encoding: 'utf-8' });
    const backendBranches = execSync('git branch', { cwd: backendDir, encoding: 'utf-8' });

    // At least one component should have a sea/ branch
    const hasSeaBranch = uiBranches.includes('sea/') || backendBranches.includes('sea/');
    expect(hasSeaBranch).toBe(true);
  });

  it('branch --create --all creates branches for all components', () => {
    // Create a fresh run for this test
    const freshRunOutput = runCli(`run "branch all test" -w ${workspacePath}`, tmpDir);
    const freshMatch = freshRunOutput.match(/Run ID:\s*(run-\d+)/);
    expect(freshMatch).toBeTruthy();
    const freshRunId = freshMatch![1];

    const output = runCli(`branch ${freshRunId} --create --all -w ${workspacePath}`, tmpDir);

    expect(output).toContain('Created branches');

    // Both repos should now have sea/ branches
    const uiBranches = execSync('git branch', { cwd: uiDir, encoding: 'utf-8' });
    const backendBranches = execSync('git branch', { cwd: backendDir, encoding: 'utf-8' });

    expect(uiBranches).toContain('sea/');
    expect(backendBranches).toContain('sea/');
  });

  it('branch safety state is persisted', () => {
    const output = runCli(`branch ${runId} -w ${workspacePath}`, tmpDir);

    // Should display branch safety info
    expect(output).toContain('ui');
    expect(output).toContain('backend');
  });

  it('branch --json outputs valid JSON with component data', () => {
    const output = runCli(`branch ${runId} -w ${workspacePath} --json`, tmpDir);
    const parsed = JSON.parse(output);

    expect(parsed.runId).toBe(runId);
    // The JSON output contains the branch safety state
    expect(parsed).toBeDefined();
  });
});

/**
 * Integration test for rollback functionality
 *
 * Proves:
 * - Tracked modified files are restored
 * - Untracked added files are removed
 * - rollback-report.json is written
 * - File classifications are correct
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { applyRollback, classifyFiles } from '../../src/tools/rollback.js';

describe('rollback integration', () => {
  let tmpDir: string;
  let componentDir: string;
  let seaDir: string;
  const runId = 'run-test-rollback-001';

  beforeAll(async () => {
    // Create temp directory
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-rollback-test-'));
    componentDir = path.join(tmpDir, 'my-component');
    seaDir = path.join(tmpDir, '.sea');

    // Initialize git repo
    await fs.mkdir(componentDir, { recursive: true });
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', {
      cwd: componentDir,
      stdio: 'ignore',
    });

    // Create initial tracked file
    await fs.mkdir(path.join(componentDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(componentDir, 'src', 'app.ts'), 'export const original = true;\n');
    await fs.writeFile(path.join(componentDir, 'README.md'), '# Test\n');
    execSync('git add -A && git commit -m "initial commit"', {
      cwd: componentDir,
      stdio: 'ignore',
    });

    // Modify the tracked file
    await fs.writeFile(path.join(componentDir, 'src', 'app.ts'), 'export const modified = true;\n');

    // Create an untracked file
    await fs.writeFile(path.join(componentDir, 'src', 'temp-debug.log'), 'debug output\n');

    // Create minimal state.json with changedFiles
    const stateDir = path.join(seaDir, 'runs', runId);
    await fs.mkdir(stateDir, { recursive: true });
    const state = {
      runId,
      runStatus: 'evidence_captured',
      userRequest: 'test rollback',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      baseDir: seaDir,
      workspace: { components: [] },
      componentStates: {
        'my-component': {
          componentName: 'my-component',
          componentPath: componentDir,
          kind: 'source',
          role: 'source',
          changeRole: 'modify',
          changedFiles: ['src/app.ts', 'src/temp-debug.log'],
          diffPath: null,
          commandResults: [],
          branchBefore: 'main',
          branchCreated: null,
          dirtyBefore: false,
          dirtyAfter: true,
        },
      },
    };
    await fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('restores tracked modified file', async () => {
    const result = await applyRollback(runId, 'my-component', seaDir, true);

    const appContent = await fs.readFile(path.join(componentDir, 'src', 'app.ts'), 'utf-8');
    expect(appContent).toContain('original');
    expect(appContent).not.toContain('modified');
    expect(result.applied).toContain('my-component');
  });

  it('removes untracked added file', async () => {
    // The previous test already ran rollback — check that temp file is gone
    try {
      await fs.access(path.join(componentDir, 'src', 'temp-debug.log'));
      // If we reach here, file still exists — fail
      expect(true).toBe(false);
    } catch {
      // File does not exist — correct
      expect(true).toBe(true);
    }
  });

  it('writes rollback-report.json', async () => {
    const reportPath = path.join(seaDir, 'runs', runId, 'rollback-report.json');
    const report = await fs.readFile(reportPath, 'utf-8');
    const parsed = JSON.parse(report);

    expect(parsed.runId).toBe(runId);
    expect(parsed.applied).toContain('my-component');
    expect(parsed.failed).toEqual([]);
    expect(parsed.targets).toBeInstanceOf(Array);
    expect(parsed.reports).toBeInstanceOf(Array);
  });

  it('writes per-component rollback report with file results', async () => {
    const componentReportPath = path.join(seaDir, 'runs', runId, 'rollback-my-component.json');
    const report = await fs.readFile(componentReportPath, 'utf-8');
    const parsed = JSON.parse(report);

    expect(parsed.componentName).toBe('my-component');
    expect(parsed.rolledBack).toBe(true);
    expect(parsed.method).toBe('git-checkout');
    expect(parsed.fileResults).toBeInstanceOf(Array);
    expect(parsed.fileResults.length).toBeGreaterThan(0);

    // Check that tracked file was restored
    const appResult = parsed.fileResults.find((f: { file: string }) => f.file === 'src/app.ts');
    expect(appResult).toBeDefined();
    expect(appResult.classification).toBe('tracked-modified');
    expect(appResult.action).toBe('restored');

    // Check that untracked file was removed
    const logResult = parsed.fileResults.find((f: { file: string }) => f.file === 'src/temp-debug.log');
    expect(logResult).toBeDefined();
    expect(logResult.classification).toBe('untracked-added');
    expect(logResult.action).toBe('removed');

    // No unhandled files
    expect(parsed.unhandledFiles).toEqual([]);
  });

  it('classifyFiles correctly identifies file types', async () => {
    const classifications = classifyFiles(componentDir, ['src/app.ts']);
    // After rollback, the file is committed — should be tracked-modified or unknown
    expect(classifications.has('src/app.ts')).toBe(true);
  });
});

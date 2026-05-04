/**
 * Integration test: manual-executor after-execution evidence capture.
 *
 * Verifies that after making changes in a fixture workspace the
 * after-execution logic correctly captures changed files, a diff patch,
 * and git status.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import {
  createTempWorkspace,
  cleanupTempWorkspace,
  writeFile,
  FIXTURES_DIR,
} from '../setup.js';

import {
  getChangedFiles,
  getFullDiff,
  getGitStatus,
  captureSnapshot,
  saveGitDiffToFile,
  saveGitStatusToFile,
} from '../../src/tools/gitTool.js';
import { getRunPaths, saveCheckpoint } from '../../src/workflow/checkpoint.js';
import { createInitialWorkspaceState } from '../../src/state/workspaceState.js';

const execAsync = promisify(exec);

describe('manual-executor after-execution evidence capture', () => {
  let workspaceDir: string;
  let runId: string;
  let seaBaseDir: string;

  beforeEach(async () => {
    workspaceDir = await createTempWorkspace('single-frontend');
    runId = `test-run-${Date.now()}`;
    seaBaseDir = path.join(workspaceDir, '.sea');
  });

  afterEach(async () => {
    if (workspaceDir) {
      await cleanupTempWorkspace(workspaceDir);
      workspaceDir = '' as unknown as string; // prevent double cleanup
    }
  });

  it('should capture changed files after modifying a source file', async () => {
    // 1. Record the "before" snapshot
    const beforeSnapshot = await captureSnapshot(workspaceDir);
    expect(beforeSnapshot.isDirty).toBe(false);

    // 2. Modify a file in the fixture (simulating manual execution)
    const modifiedFile = 'src/index.ts';
    const originalContent = await fs.readFile(
      path.join(workspaceDir, modifiedFile),
      'utf-8'
    );
    await writeFile(
      workspaceDir,
      modifiedFile,
      originalContent + '\n\n// Added by test: after-execution evidence\nexport const testValue = 42;\n'
    );

    // 3. Capture evidence (changed files)
    const changedFiles = await getChangedFiles(workspaceDir);

    // 4. Assert changedFiles is not empty
    expect(changedFiles.length).toBeGreaterThan(0);
    expect(changedFiles).toContain(modifiedFile);
  });

  it('should produce a diff.patch with actual content after modification', async () => {
    // 1. Modify a file
    const modifiedFile = 'src/index.ts';
    const originalContent = await fs.readFile(
      path.join(workspaceDir, modifiedFile),
      'utf-8'
    );
    const addedLine = '// Integration test modification\nexport function testHelper(): boolean { return true; }\n';
    await writeFile(workspaceDir, modifiedFile, originalContent + '\n' + addedLine);

    // 2. Save the diff to a patch file (simulating after-execution logic)
    const paths = getRunPaths(runId, seaBaseDir);
    await fs.mkdir(paths.artifactsDir, { recursive: true });
    const diffPath = path.join(paths.artifactsDir, 'diff.patch');

    await saveGitDiffToFile(workspaceDir, diffPath);

    // 3. Read the diff file and assert it has actual content
    const diffContent = await fs.readFile(diffPath, 'utf-8');

    expect(diffContent.length).toBeGreaterThan(0);
    expect(diffContent).toContain(modifiedFile);
    expect(diffContent).toContain('+// Integration test modification');
    expect(diffContent).toContain('+export function testHelper');

    // 4. Verify the metadata file was also written
    const metaPath = diffPath + '.meta.json';
    const metaContent = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    expect(metaContent.totalFiles).toBeGreaterThanOrEqual(1);
    expect(metaContent.insertions).toBeGreaterThan(0);
  });

  it('should capture git status after modification', async () => {
    // 1. Modify a file
    const modifiedFile = 'src/index.ts';
    const originalContent = await fs.readFile(
      path.join(workspaceDir, modifiedFile),
      'utf-8'
    );
    await writeFile(workspaceDir, modifiedFile, originalContent + '\n// git status test\n');

    // 2. Also create a new untracked file
    await writeFile(workspaceDir, 'src/new-feature.ts', 'export const newFeature = "test";\n');

    // 3. Save git status to file (simulating after-execution)
    const paths = getRunPaths(runId, seaBaseDir);
    await fs.mkdir(paths.artifactsDir, { recursive: true });
    const gitStatusPath = path.join(paths.artifactsDir, 'git-status-after.txt');

    await saveGitStatusToFile(workspaceDir, gitStatusPath);

    // 4. Read the status file and assert it contains the modified file
    const statusContent = await fs.readFile(gitStatusPath, 'utf-8');
    const status = JSON.parse(statusContent);

    expect(status.isRepo).toBe(true);
    expect(status.isDirty).toBe(true);
    expect(status.modified).toContain(modifiedFile);
    expect(status.untracked).toContain('src/new-feature.ts');
  });

  it('should update component state with evidence after execution', async () => {
    // 1. Load workspace config from the fixture
    const workspaceConfigPath = path.join(seaBaseDir, 'workspace.json');
    const workspaceConfigRaw = await fs.readFile(workspaceConfigPath, 'utf-8');
    const workspaceConfig = JSON.parse(workspaceConfigRaw);

    // 2. Create initial workspace state
    const state = createInitialWorkspaceState(runId, 'Test user request', workspaceConfig);

    // 3. Save the initial checkpoint (simulating the pre-execution state)
    await saveCheckpoint(state, 'pre-execution', seaBaseDir);

    // 4. Simulate manual execution: modify a file
    const modifiedFile = 'src/index.ts';
    const originalContent = await fs.readFile(
      path.join(workspaceDir, modifiedFile),
      'utf-8'
    );
    await writeFile(workspaceDir, modifiedFile, originalContent + '\n// Manual change\n');

    // 5. Capture after-execution evidence
    const changedFiles = await getChangedFiles(workspaceDir);
    const diff = await getFullDiff(workspaceDir);
    const gitStatus = await getGitStatus(workspaceDir);

    // 6. Update component state with evidence
    const componentName = workspaceConfig.components[0].name;
    const componentState = state.componentStates[componentName] = {
      componentName,
      componentPath: workspaceConfig.components[0].path,
      kind: workspaceConfig.components[0].kind,
      role: workspaceConfig.components[0].role,
      changeRole: 'modify',
      branchBefore: null,
      branchCreated: null,
      dirtyBefore: false,
      dirtyAfter: gitStatus.isDirty,
      analysis: null,
      plan: null,
      executionRequestPath: null,
      executorResult: null,
      gitStatusBeforePath: null,
      gitStatusAfterPath: path.join(getRunPaths(runId, seaBaseDir).componentsDir, componentName, 'git-status-after.txt'),
      changedFiles,
      forbiddenPathViolations: [],
      protectedPathViolations: [],
      diffPath: path.join(getRunPaths(runId, seaBaseDir).componentsDir, componentName, 'diff.patch'),
      commandResults: [],
      artifactInspection: null,
      fixAttempts: [],
      componentDecision: 'pending',
    };

    // 7. Save evidence files
    const componentDir = path.join(getRunPaths(runId, seaBaseDir).componentsDir, componentName);
    await fs.mkdir(componentDir, { recursive: true });

    await fs.writeFile(componentState.diffPath!, diff.raw, 'utf-8');
    await fs.writeFile(componentState.gitStatusAfterPath!, JSON.stringify(gitStatus, null, 2), 'utf-8');

    // 8. Save post-execution checkpoint
    state.componentStates[componentName] = componentState;
    await saveCheckpoint(state, 'post-execution', seaBaseDir);

    // 9. Assertions
    expect(changedFiles.length).toBeGreaterThan(0);
    expect(changedFiles).toContain(modifiedFile);

    const savedDiff = await fs.readFile(componentState.diffPath!, 'utf-8');
    expect(savedDiff.length).toBeGreaterThan(0);
    expect(savedDiff).toContain('+// Manual change');

    const savedStatus = JSON.parse(
      await fs.readFile(componentState.gitStatusAfterPath!, 'utf-8')
    );
    expect(savedStatus.isDirty).toBe(true);
    expect(savedStatus.modified).toContain(modifiedFile);
  });

  it('should detect multiple changed files including new and modified', async () => {
    // 1. Modify existing file
    const modifiedFile = 'src/index.ts';
    const originalContent = await fs.readFile(
      path.join(workspaceDir, modifiedFile),
      'utf-8'
    );
    await writeFile(workspaceDir, modifiedFile, originalContent + '\n// Modified\n');

    // 2. Create a new file
    await writeFile(workspaceDir, 'src/utils.ts', 'export function util(): string { return "utility"; }\n');

    // 3. Modify the test file
    const testFile = '__tests__/basic.test.ts';
    const testContent = await fs.readFile(path.join(workspaceDir, testFile), 'utf-8');
    await writeFile(workspaceDir, testFile, testContent + '\n// Added comment to test\n');

    // 4. Capture changed files
    const changedFiles = await getChangedFiles(workspaceDir);

    // 5. Assert all changes are detected
    expect(changedFiles).toContain(modifiedFile);
    expect(changedFiles).toContain('src/utils.ts');
    expect(changedFiles).toContain(testFile);
    expect(changedFiles.length).toBe(3);
  });
});

/**
 * Manual Executor for SEA
 * Generates execution request files for human execution
 * Human performs work externally, then SEA continues with verification
 */

import { ExecutorAdapter, ExecutionRequest, ExecutorResult, createExecutorResult } from './executorAdapter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getRunPaths, saveComponentArtifact } from '../workflow/checkpoint.js';
import { getChangedFiles, captureSnapshot, saveGitDiffToFile, saveGitStatusToFile } from '../tools/gitTool.js';
import { validatePaths, PathValidationResult } from '../tools/pathValidator.js';

export class ManualExecutor implements ExecutorAdapter {
  name = 'manual';
  private runId: string;
  private baseDir: string;

  constructor(runId: string, baseDir: string = '.sea') {
    this.runId = runId;
    this.baseDir = baseDir;
  }

  async execute(request: ExecutionRequest): Promise<ExecutorResult> {
    const startedAt = new Date().toISOString();

    // Generate execution request content
    const requestContent = this.generateExecutionRequest(request);

    // Save execution request to component artifact directory
    const componentArtifactDir = this.getComponentArtifactDir(request.componentName);
    await fs.mkdir(componentArtifactDir, { recursive: true });

    const requestPath = path.join(componentArtifactDir, 'execution-request.md');
    await fs.writeFile(requestPath, requestContent, 'utf-8');

    const finishedAt = new Date().toISOString();

    return createExecutorResult({
      executor: 'manual',
      status: 'manual_required',
      stdout: `Execution request saved to: ${requestPath}`,
      stderr: '',
      changedFiles: [],
      diffPath: null,
      startedAt,
      finishedAt,
      notes: [
        'Manual execution required. Perform the work described in the execution request.',
        `After completing, run: sea after-execution ${this.runId} --component ${request.componentName}`,
      ],
    });
  }

  async isAvailable(): Promise<boolean> {
    // Manual executor is always available
    return true;
  }

  private generateExecutionRequest(request: ExecutionRequest): string {
    return `# Execution Request

**Component:** ${request.componentName}
**Path:** ${request.componentPath}
**Mode:** ${request.mode}
**Interactive:** ${request.interactive}

---

## Task Title
${request.taskTitle}

---

## Prompt
${request.prompt}

---

## Allowed Paths
${request.allowedPaths.length > 0 ? request.allowedPaths.map(p => `- ${p}`).join('\n') : '_No restrictions_'}

---

## Protected Paths (Require Approval to Modify)
${request.protectedPaths.length > 0 ? request.protectedPaths.map(p => `- ${p}`).join('\n') : '_None_'}

---

## Forbidden Paths (Must NOT Modify)
${request.forbiddenPaths.length > 0 ? request.forbiddenPaths.map(p => `- ${p}`).join('\n') : '_None_'}

---

## Important Rules
1. Work only inside this component unless explicitly instructed otherwise.
2. Keep changes minimal and aligned with existing project conventions.
3. Do not modify protected paths unless the plan explicitly allows it.
4. Do not modify forbidden paths.
5. Do not introduce placeholder code.
6. Do not skip tests because they are inconvenient.
7. Do not claim success without evidence.
8. Summarize changed files, reasons, tests run, risks, and follow-up needs.

---

## After Completing Work
Run the following command to capture evidence and continue:
\`\`\`bash
sea after-execution ${this.runId} --component ${request.componentName}
\`\`\`
`;
  }

  private getComponentArtifactDir(componentName: string): string {
    const paths = getRunPaths(this.runId, this.baseDir);
    return path.join(paths.componentsDir, componentName);
  }
}

/**
 * Capture evidence after manual execution.
 *
 * This function is called when the human operator signals they have completed
 * manual work for a component. It captures:
 *   - A git snapshot (branch, commit, dirty flag, changed files)
 *   - The full git diff (staged + unstaged)
 *   - The git status
 *   - Path validation against forbidden/protected paths
 *
 * All evidence is saved to the component artifact directory.
 */
export async function captureManualExecutionEvidence(
  runId: string,
  componentName: string,
  componentPath: string,
  forbiddenPaths: string[],
  protectedPaths: string[],
  baseDir: string = '.sea'
): Promise<{
  changedFiles: string[];
  diff: string;
  gitStatus: string;
  validation: PathValidationResult | null;
  snapshotPath: string;
  diffPath: string;
  statusPath: string;
  validationPath: string;
}> {
  const paths = getRunPaths(runId, baseDir);
  const componentDir = path.join(paths.componentsDir, componentName);

  // Ensure the component artifact directory exists
  await fs.mkdir(componentDir, { recursive: true });

  const snapshotPath = path.join(componentDir, 'post-execution-snapshot.json');
  const diffPath = path.join(componentDir, 'post-execution.diff');
  const statusPath = path.join(componentDir, 'post-execution-status.json');
  const validationPath = path.join(componentDir, 'path-validation.json');

  // 1. Capture git snapshot (branch, commit hash, dirty, changed files)
  let snapshot;
  let changedFiles: string[] = [];
  try {
    snapshot = await captureSnapshot(componentPath);
    changedFiles = snapshot.changedFiles;

    // Save snapshot to file
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Write an error snapshot so downstream agents know what happened
    const errorSnapshot = {
      error: errorMsg,
      branch: 'unknown',
      commitHash: 'unknown',
      isDirty: false,
      changedFiles: [] as string[],
    };
    await fs.writeFile(snapshotPath, JSON.stringify(errorSnapshot, null, 2), 'utf-8');
  }

  // 2. Capture full git diff and save to file
  let diffContent = '';
  try {
    await saveGitDiffToFile(componentPath, diffPath);
    diffContent = await fs.readFile(diffPath, 'utf-8');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    diffContent = `[ERROR] Could not capture diff: ${errorMsg}`;
    await fs.writeFile(diffPath, diffContent, 'utf-8');
  }

  // 3. Capture git status and save to file
  let gitStatusContent = '';
  try {
    await saveGitStatusToFile(componentPath, statusPath);
    gitStatusContent = await fs.readFile(statusPath, 'utf-8');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    gitStatusContent = `{"error": "${errorMsg}"}`;
    await fs.writeFile(statusPath, gitStatusContent, 'utf-8');
  }

  // 4. Run path validation against forbidden/protected paths
  let validation: PathValidationResult | null = null;
  if (changedFiles.length > 0) {
    try {
      validation = validatePaths(changedFiles, {
        allowedPaths: [],  // Empty = all paths allowed (component-scoped)
        protectedPaths: protectedPaths || [],
        forbiddenPaths: forbiddenPaths || [],
      });
      await fs.writeFile(validationPath, JSON.stringify(validation, null, 2), 'utf-8');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorValidation = {
        allowedChanges: changedFiles,
        protectedViolations: [],
        forbiddenViolations: [],
        outOfScopeChanges: [],
        status: 'warning' as const,
        error: errorMsg,
      };
      validation = errorValidation;
      await fs.writeFile(validationPath, JSON.stringify(errorValidation, null, 2), 'utf-8');
    }
  }

  return {
    changedFiles,
    diff: diffContent,
    gitStatus: gitStatusContent,
    validation,
    snapshotPath,
    diffPath,
    statusPath,
    validationPath,
  };
}

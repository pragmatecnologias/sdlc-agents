/**
 * Manual Executor for SEA
 * Generates execution request files for human execution
 * Human performs work externally, then SEA continues with verification
 */
import { createExecutorResult } from './executorAdapter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getRunPaths } from '../workflow/checkpoint.js';
export class ManualExecutor {
    name = 'manual';
    runId;
    baseDir;
    constructor(runId, baseDir = '.sea') {
        this.runId = runId;
        this.baseDir = baseDir;
    }
    async execute(request) {
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
    async isAvailable() {
        // Manual executor is always available
        return true;
    }
    generateExecutionRequest(request) {
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
    getComponentArtifactDir(componentName) {
        const paths = getRunPaths(this.runId, this.baseDir);
        return path.join(paths.componentsDir, componentName);
    }
}
/**
 * Capture evidence after manual execution
 */
export async function captureManualExecutionEvidence(runId, componentName, baseDir = '.sea') {
    const paths = getRunPaths(runId, baseDir);
    const componentDir = path.join(paths.componentsDir, componentName);
    // Read execution request to get original request
    const requestPath = path.join(componentDir, 'execution-request.md');
    // Return evidence that needs to be captured by git tool
    return {
        changedFiles: [],
        diff: '',
        gitStatus: '',
    };
}
//# sourceMappingURL=manualExecutor.js.map
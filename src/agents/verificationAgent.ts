/**
 * Verification Agent for SEA
 * Runs ALL configured verification commands and collects evidence
 */

import { WorkspaceState, ComponentState } from '../state/workspaceState.js';
import { VerificationSummary, CommandResult } from '../state/workspaceState.js';
import { runCommand } from '../tools/commandRunner.js';
import { saveComponentArtifact, getRunPaths } from '../workflow/checkpoint.js';
import { resolveComponentPathFromState } from '../tools/resolvePath.js';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VerificationAgent');

/**
 * Ordered list of standard command keys to run, with their display names
 * and whether they count as "test" or "build" for summary tracking.
 */
const STANDARD_COMMANDS: Array<{
  key: 'install' | 'lint' | 'typecheck' | 'test' | 'build' | 'e2e' | 'smoke';
  displayName: string;
  isTest: boolean;
  isBuild: boolean;
}> = [
  { key: 'install', displayName: 'install', isTest: false, isBuild: false },
  { key: 'lint', displayName: 'lint', isTest: false, isBuild: false },
  { key: 'typecheck', displayName: 'typecheck', isTest: false, isBuild: false },
  { key: 'test', displayName: 'test', isTest: true, isBuild: false },
  { key: 'build', displayName: 'build', isTest: false, isBuild: true },
  { key: 'e2e', displayName: 'e2e', isTest: true, isBuild: false },
  { key: 'smoke', displayName: 'smoke', isTest: true, isBuild: false },
];

/**
 * Create the verification agent function
 */
export function createVerificationAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running verification agent');

    const { componentStates, workspace } = state;

    // Deep clone component states so we can mutate them
    const updatedComponentStates: Record<string, ComponentState> = {};
    for (const [name, cs] of Object.entries(componentStates || {})) {
      updatedComponentStates[name] = { ...cs };
    }

    const componentResults: VerificationSummary['componentResults'] = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCommandsRun = 0;
    let testsRun = false;
    let buildsRun = false;

    // Run verification for each component
    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      const component = workspace.components?.find(c => c.name === componentName);
      if (!component) {
        logger.warn(`Component ${componentName} not found in workspace config - skipping`);
        continue;
      }

      // Skip components that had no changes
      if (componentState.changeRole === 'no_change' || componentState.changeRole === 'unknown') {
        componentResults[componentName] = {
          status: 'skipped',
          commandsRun: 0,
          commandsPassed: 0,
          commandsFailed: 0,
        };
        updatedComponentStates[componentName].componentDecision = 'skipped';
        continue;
      }

      let commandsRun = 0;
      let commandsPassed = 0;
      let commandsFailed = 0;
      const commandResults: CommandResult[] = [];
      let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';

      // Determine the save directory for command output
      const runPaths = getRunPaths(state.runId, state.baseDir);
      const componentSaveDir = path.join(runPaths.componentsDir, componentName);

      // Build the ordered list of commands to run for this component
      const commandsToRun: Array<{ name: string; command: string; isTest: boolean; isBuild: boolean }> = [];

      // Add standard commands that are configured
      for (const stdCmd of STANDARD_COMMANDS) {
        const cmdValue = component.commands?.[stdCmd.key];
        if (cmdValue) {
          commandsToRun.push({
            name: stdCmd.displayName,
            command: cmdValue,
            isTest: stdCmd.isTest,
            isBuild: stdCmd.isBuild,
          });
        }
      }

      // Add any custom commands
      if (component.commands?.custom) {
        for (const [customName, customCommand] of Object.entries(component.commands.custom)) {
          commandsToRun.push({
            name: `custom:${customName}`,
            command: customCommand,
            isTest: customName.includes('test'),
            isBuild: customName.includes('build'),
          });
        }
      }

      // If no commands configured at all, mark as skipped
      if (commandsToRun.length === 0) {
        logger.info(`Component ${componentName} has no commands configured - skipping`);
        componentResults[componentName] = {
          status: 'skipped',
          commandsRun: 0,
          commandsPassed: 0,
          commandsFailed: 0,
        };
        updatedComponentStates[componentName].componentDecision = 'skipped';
        continue;
      }

      // Execute each command in sequence
      for (const cmd of commandsToRun) {
        try {
          logger.info(`Running ${cmd.name} for ${componentName}: ${cmd.command}`);

          const resolvedComponentPath = resolveComponentPathFromState(state, component);

          const result = await runCommand(cmd.command, {
            cwd: resolvedComponentPath,
            timeout: 300000,
            autoSave: true,
            saveDir: componentSaveDir,
            commandName: cmd.name,
          });

          commandsRun++;
          totalCommandsRun++;
          commandResults.push(result);

          if (cmd.isTest) testsRun = true;
          if (cmd.isBuild) buildsRun = true;

          if (result.status === 'passed') {
            commandsPassed++;
            totalPassed++;
          } else {
            commandsFailed++;
            totalFailed++;
          }

          logger.info(
            `${cmd.name} for ${componentName}: ${result.status} (exitCode: ${result.exitCode}, ${result.durationMs}ms)`
          );
        } catch (error) {
          commandsFailed++;
          totalFailed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`${cmd.name} for ${componentName} threw: ${errorMsg}`);

          commandResults.push({
            component: component.name,
            commandName: cmd.name,
            command: cmd.command,
            exitCode: -1,
            status: 'failed',
            stdout: '',
            stderr: errorMsg,
            stdoutPath: '',
            stderrPath: '',
            durationMs: 0,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          });
        }
      }

      // Determine overall component status
      if (commandsRun > 0) {
        status = commandsFailed > 0 ? 'failed' : 'passed';
      }

      // Store command results on the component state
      updatedComponentStates[componentName].commandResults = commandResults;

      // Set component decision based on results
      if (status === 'passed') {
        updatedComponentStates[componentName].componentDecision = 'verified';
      } else if (status === 'failed') {
        updatedComponentStates[componentName].componentDecision = 'needs_fix';
      }

      // Save command results summary to component artifact directory
      const resultsSummary = commandResults.map(r => ({
        commandName: r.commandName,
        command: r.command,
        status: r.status,
        exitCode: r.exitCode,
        durationMs: r.durationMs,
        stdoutPath: r.stdoutPath,
        stderrPath: r.stderrPath,
      }));
      await saveComponentArtifact(
        state,
        componentName,
        'verification-results.json',
        JSON.stringify(resultsSummary, null, 2)
      );

      componentResults[componentName] = {
        status,
        commandsRun,
        commandsPassed,
        commandsFailed,
      };
    }

    // Determine overall status
    const overallStatus: 'passed' | 'failed' | 'partial' | 'skipped' =
      totalCommandsRun === 0
        ? 'skipped'
        : totalFailed === 0
          ? 'passed'
          : totalPassed > 0
            ? 'partial'
            : 'failed';

    const summary: VerificationSummary = {
      overallStatus,
      componentResults,
      totalCommandsRun,
      totalPassed,
      totalFailed,
      testsRun,
      buildsRun,
    };

    logger.info(`Verification complete: ${totalPassed}/${totalCommandsRun} passed, ${totalFailed} failed`);

    return {
      verification: summary,
      componentStates: updatedComponentStates,
    };
  };
}

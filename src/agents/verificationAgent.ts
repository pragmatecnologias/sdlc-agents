/**
 * Verification Agent for SEA
 * Runs verification commands and collects evidence
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { VerificationSummary } from '../state/workspaceState.js';
import { runCommand } from '../tools/commandRunner.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VerificationAgent');

/**
 * Create the verification agent function
 */
export function createVerificationAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running verification agent');

    const { componentStates, workspace } = state;

    const componentResults: VerificationSummary['componentResults'] = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCommandsRun = 0;
    let testsRun = false;
    let buildsRun = false;

    // Run verification for each component
    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      const component = workspace.components?.find(c => c.name === componentName);
      if (!component) continue;

      let commandsRun = 0;
      let commandsPassed = 0;
      let commandsFailed = 0;
      let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';

      // Run component's test command if available
      if (component.commands?.test) {
        try {
          const result = await runCommand(component.commands.test, {
            cwd: component.path,
            timeout: 300000,
          });

          commandsRun++;
          totalCommandsRun++;
          testsRun = true;

          if (result.exitCode === 0) {
            commandsPassed++;
            totalPassed++;
          } else {
            commandsFailed++;
            totalFailed++;
          }
        } catch (error) {
          commandsFailed++;
          totalFailed++;
        }
      }

      // Run component's build command if available
      if (component.commands?.build) {
        try {
          const result = await runCommand(component.commands.build, {
            cwd: component.path,
            timeout: 300000,
          });

          commandsRun++;
          totalCommandsRun++;
          buildsRun = true;

          if (result.exitCode === 0) {
            commandsPassed++;
            totalPassed++;
          } else {
            commandsFailed++;
            totalFailed++;
          }
        } catch (error) {
          commandsFailed++;
          totalFailed++;
        }
      }

      if (commandsRun > 0) {
        status = commandsFailed > 0 ? 'failed' : 'passed';
      } else {
        status = 'skipped';
      }

      componentResults[componentName] = {
        status,
        commandsRun,
        commandsPassed,
        commandsFailed,
      };
    }

    const overallStatus: 'passed' | 'failed' | 'skipped' | 'partial' =
      totalFailed === 0 ? 'passed' : totalPassed > 0 ? 'partial' : 'failed';

    const summary: VerificationSummary = {
      overallStatus,
      componentResults,
      totalCommandsRun,
      totalPassed,
      totalFailed,
      testsRun,
      buildsRun,
    };

    logger.info(`Verification complete: ${totalPassed}/${totalCommandsRun} passed`);

    return { verification: summary };
  };
}

/**
 * Execution Agent for SEA
 * Executes implementation via executor adapter
 * Reads state.implementationPlan to get execution groups and processes each component
 */

import { WorkspaceState, ComponentState } from '../state/workspaceState.js';
import { ExecutionGroupPlan, ComponentImplementationPlan } from '../state/workspaceState.js';
import { createLogger } from '../utils/logger.js';
import { saveComponentArtifact, getRunPaths } from '../workflow/checkpoint.js';

const logger = createLogger('ExecutionAgent');

/**
 * Create the execution agent function
 */
export function createExecutionAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running execution agent');

    const { implementationPlan, workspace, componentStates: existingComponentStates } = state;

    if (!implementationPlan) {
      logger.warn('No implementation plan found - skipping execution');
      return {};
    }

    const updatedComponentStates: Record<string, ComponentState> = {
      ...existingComponentStates,
    };

    const updatedExecutionGroups: typeof state.executionGroups = [];
    let hasAwaitingManual = false;

    // Process each execution group
    for (const group of implementationPlan.executionGroups) {
      const groupState: {
        groupId: string;
        description: string;
        components: string[];
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
        startedAt: string;
        completedAt?: string;
      } = {
        groupId: group.groupId,
        description: group.description,
        components: group.components,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      };
      updatedExecutionGroups.push(groupState);

      for (const componentName of group.components) {
        const component = workspace.components?.find(c => c.name === componentName);
        const componentPlan = implementationPlan.componentPlans?.find(
          p => p.component === componentName
        );

        if (!component) {
          logger.warn(`Component ${componentName} not found in workspace config - skipping`);
          continue;
        }

        // Check if component state already exists
        if (!updatedComponentStates[componentName]) {
          const changeRole = componentPlan?.changeRole ?? state.impactAnalysis?.affectedComponents
            ?.find(ac => ac.component === componentName)?.changeRole ?? 'unknown';

          // Determine dirty state from workspace discovery
          const dirtyBefore = state.workspaceDiscovery?.isDirty ?? false;

          updatedComponentStates[componentName] = {
            componentName,
            componentPath: component.path,
            kind: component.kind,
            role: component.role,
            changeRole,
            branchBefore: null,
            branchCreated: null,
            dirtyBefore,
            dirtyAfter: false,
            analysis: null,
            plan: componentPlan ?? null,
            executionRequestPath: null,
            executorResult: null,
            gitStatusBeforePath: null,
            gitStatusAfterPath: null,
            changedFiles: [],
            forbiddenPathViolations: [],
            protectedPathViolations: [],
            diffPath: null,
            commandResults: [],
            artifactInspection: null,
            fixAttempts: [],
            componentDecision: 'pending',
          };
        }

        const cs = updatedComponentStates[componentName];

        // Skip components that already have evidence captured (resume after after-execution)
        if (cs.executorResult?.status === 'completed' || cs.executorResult?.status === 'completed_no_changes') {
          logger.info(`Component ${componentName} already has evidence captured - skipping`);
          continue;
        }

        // Determine executor type from workspace config
        const executor = (workspace.defaultExecutor || 'manual') as string;

        if (executor === 'manual') {
          logger.info(`Component ${componentName} requires manual execution`);

          // Build execution request content
          const requestContent = buildExecutionRequestMarkdown(
            state,
            componentName,
            component.path,
            componentPlan,
            group
          );

          // Save execution request as markdown file
          await saveComponentArtifact(
            state,
            componentName,
            'execution-request.md',
            requestContent
          );

          // Update component state
          cs.executorResult = {
            executor: 'manual' as const,
            status: 'manual_required' as const,
            stdout: `Execution request saved to component artifacts directory`,
            stderr: '',
            changedFiles: [],
            diffPath: null,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            notes: [
              'Manual execution required. Perform the work described in the execution request.',
              `After completing, run: sea after-execution ${state.runId} --component ${componentName}`,
            ],
          };
          cs.executionRequestPath = `components/${componentName}/execution-request.md`;
          cs.componentDecision = 'pending';
          hasAwaitingManual = true;
        } else {
          // For non-manual executors, mark as awaiting execution
          logger.info(`Component ${componentName} queued for ${executor} executor`);
          cs.componentDecision = 'pending';
        }
      }

      // Mark group as completed if no manual execution required
      if (!group.components.some(name => updatedComponentStates[name]?.executorResult?.status === 'manual_required')) {
        groupState.status = 'completed';
        groupState.completedAt = new Date().toISOString();
      }
    }

    // Determine run status
    // If evidence was already captured (resume after after-execution), preserve that status
    const newRunStatus = state.runStatus === 'evidence_captured'
      ? 'evidence_captured'
      : hasAwaitingManual
        ? 'awaiting_manual_execution'
        : 'executing';

    logger.info(
      `Execution setup complete: ${Object.keys(updatedComponentStates).length} components processed, status: ${newRunStatus}`
    );

    return {
      componentStates: updatedComponentStates,
      executionGroups: updatedExecutionGroups,
      runStatus: newRunStatus,
    };
  };
}

/**
 * Build a markdown execution request document for a component
 */
function buildExecutionRequestMarkdown(
  state: WorkspaceState,
  componentName: string,
  componentPath: string,
  componentPlan: ComponentImplementationPlan | undefined,
  group: ExecutionGroupPlan
): string {
  const lines: string[] = [];

  lines.push(`# Execution Request`);
  lines.push('');
  lines.push(`**Component:** ${componentName}`);
  lines.push(`**Path:** ${componentPath}`);
  lines.push(`**Run ID:** ${state.runId}`);
  lines.push(`**Group:** ${group.groupId} - ${group.description}`);
  lines.push('');

  if (state.requirement) {
    lines.push('## Requirement');
    lines.push('');
    lines.push(`**Title:** ${state.requirement.title}`);
    lines.push('');
    lines.push(`**Business Goal:** ${state.requirement.businessGoal}`);
    lines.push('');

    if (state.requirement.functionalRequirements.length > 0) {
      lines.push('### Functional Requirements');
      for (const req of state.requirement.functionalRequirements) {
        lines.push(`- ${req}`);
      }
      lines.push('');
    }

    if (state.requirement.acceptanceCriteria.length > 0) {
      lines.push('### Acceptance Criteria');
      for (const ac of state.requirement.acceptanceCriteria) {
        lines.push(`- ${ac}`);
      }
      lines.push('');
    }
  }

  if (componentPlan) {
    lines.push('## Implementation Plan');
    lines.push('');

    if (componentPlan.steps.length > 0) {
      lines.push('### Steps');
      for (let i = 0; i < componentPlan.steps.length; i++) {
        lines.push(`${i + 1}. ${componentPlan.steps[i]}`);
      }
      lines.push('');
    }

    if (componentPlan.verificationExpectations.length > 0) {
      lines.push('### Verification Expectations');
      for (const ve of componentPlan.verificationExpectations) {
        lines.push(`- ${ve}`);
      }
      lines.push('');
    }

    if (componentPlan.definitionOfDone.length > 0) {
      lines.push('### Definition of Done');
      for (const dod of componentPlan.definitionOfDone) {
        lines.push(`- [ ] ${dod}`);
      }
      lines.push('');
    }

    if (componentPlan.allowedPaths.length > 0) {
      lines.push('### Allowed Paths');
      for (const p of componentPlan.allowedPaths) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }

    if (componentPlan.protectedPaths.length > 0) {
      lines.push('### Protected Paths (Require Approval)');
      for (const p of componentPlan.protectedPaths) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }

    if (componentPlan.forbiddenPaths.length > 0) {
      lines.push('### Forbidden Paths (Must NOT Modify)');
      for (const p of componentPlan.forbiddenPaths) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }
  }

  if (state.architecturePlan?.rollbackStrategy?.length) {
    lines.push('## Rollback Strategy');
    for (const rs of state.architecturePlan.rollbackStrategy) {
      lines.push(`- ${rs}`);
    }
    lines.push('');
  }

  lines.push('## Important Rules');
  lines.push('1. Work only inside this component unless explicitly instructed otherwise.');
  lines.push('2. Keep changes minimal and aligned with existing project conventions.');
  lines.push('3. Do not modify protected paths unless the plan explicitly allows it.');
  lines.push('4. Do not modify forbidden paths.');
  lines.push('5. Do not introduce placeholder code.');
  lines.push('6. Do not skip tests because they are inconvenient.');
  lines.push('7. Do not claim success without evidence.');
  lines.push('8. Summarize changed files, reasons, tests run, risks, and follow-up needs.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## After Completing Work');
  lines.push('Run the following command to capture evidence and continue:');
  lines.push('```bash');
  lines.push(`sea after-execution ${state.runId} --component ${componentName}`);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

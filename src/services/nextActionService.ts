/**
 * Next Action Service for SEA
 *
 * Inspects WorkspaceState and returns the next recommended action.
 * This is the core decision engine for the interactive UI.
 */

import { WorkspaceState, ComponentState } from '../state/workspaceState.js';

export type NextActionType =
  | 'OPEN_EXECUTION_REQUEST'
  | 'CAPTURE_EVIDENCE'
  | 'RUN_VERIFICATION'
  | 'INSPECT_ARTIFACT'
  | 'SHOW_REPORT'
  | 'RESUME'
  | 'FIX_BLOCKER'
  | 'NONE';

export interface NextAction {
  type: NextActionType;
  runId: string;
  reason: string;
  component?: string;
  command?: string;
  details?: string[];
  canRunInteractively: boolean;
}

/**
 * Determine the next recommended action for a run.
 *
 * Priority order:
 * 1. FIX_BLOCKER - if there are errors/blockers, fix them first
 * 2. OPEN_EXECUTION_REQUEST - components pending execution
 * 3. CAPTURE_EVIDENCE - components with execution requests but no evidence
 * 4. RUN_VERIFICATION - evidence captured but verification not complete
 * 5. INSPECT_ARTIFACT - verification complete but artifact not inspected
 * 6. RESUME - ready to continue to next phase
 * 7. SHOW_REPORT - final decision exists
 * 8. NONE - run is complete
 */
export function determineNextAction(state: WorkspaceState): NextAction {
  const { runId, runStatus, componentStates, finalDecision, errors, verification, brutalRealityCheck } = state;

  // Check for blockers first
  if (errors && errors.length > 0) {
    const errorMessages = errors.map(e => (e as { error?: string }).error || String(e));
    return {
      type: 'FIX_BLOCKER',
      runId,
      reason: `Run has ${errors.length} error(s)`,
      details: errorMessages,
      canRunInteractively: false,
    };
  }

  // Check runStatus-based routing
  switch (runStatus) {
    case 'awaiting_manual_execution':
      return determineAwaitingManualExecutionAction(state);

    case 'evidence_captured':
      return determineEvidenceCapturedAction(state);

    case 'verifying':
      // Verification in progress
      return {
        type: 'RUN_VERIFICATION',
        runId,
        reason: 'Verification is currently running',
        command: `sea verify ${runId} -w <workspace>`,
        canRunInteractively: true,
      };

    case 'reviewing':
      return {
        type: 'RESUME',
        runId,
        reason: 'Run is in review phase, ready to continue',
        command: `sea resume ${runId} -w <workspace>`,
        canRunInteractively: true,
      };

    case 'completed':
    case 'failed':
    case 'blocked':
    case 'aborted':
      return {
        type: 'SHOW_REPORT',
        runId,
        reason: `Run has ended with status: ${runStatus}`,
        command: `sea report ${runId} -w <workspace>`,
        canRunInteractively: true,
      };

    default:
      // For 'initialized', 'planning', 'awaiting_approval', 'executing'
      // Check if we need to resume from a checkpoint
      if (brutalRealityCheck || finalDecision) {
        return {
          type: 'SHOW_REPORT',
          runId,
          reason: 'Run has partial results available',
          command: `sea report ${runId} -w <workspace>`,
          canRunInteractively: true,
        };
      }
      return {
        type: 'NONE',
        runId,
        reason: `Run is in phase: ${runStatus}`,
        canRunInteractively: false,
      };
  }
}

function determineAwaitingManualExecutionAction(state: WorkspaceState): NextAction {
  const { runId, componentStates } = state;

  // Find components that need evidence captured vs. those still waiting for execution
  const needsEvidence: string[] = [];
  const needsExecution: string[] = [];

  for (const [name, cs] of Object.entries(componentStates)) {
    if (cs.changeRole === 'no_change' || cs.changeRole === 'unknown') {
      continue;
    }

    if (cs.executorResult && (cs.executorResult.status === 'completed' || cs.executorResult.status === 'manual_required')) {
      // Execution happened but no evidence captured
      if (!cs.diffPath && cs.changedFiles.length === 0) {
        needsEvidence.push(name);
      }
    } else if (!cs.executorResult || cs.executorResult.status === 'manual_required') {
      // Needs execution request
      needsExecution.push(name);
    }
  }

  // Prioritize evidence capture over new execution requests
  if (needsEvidence.length > 0) {
    const component = needsEvidence[0];
    return {
      type: 'CAPTURE_EVIDENCE',
      runId,
      reason: `${component} has completed execution but no evidence captured`,
      component,
      command: `sea after-execution ${runId} -c ${component} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  if (needsExecution.length > 0) {
    const component = needsExecution[0];
    return {
      type: 'OPEN_EXECUTION_REQUEST',
      runId,
      reason: `${component} is waiting for manual execution`,
      component,
      command: `sea request ${runId} -c ${component} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  // Check if all components have execution requests but nothing has been done
  return {
    type: 'NONE',
    runId,
    reason: 'All components have execution requests, awaiting manual work',
    canRunInteractively: false,
  };
}

function determineEvidenceCapturedAction(state: WorkspaceState): NextAction {
  const { runId, componentStates, verification } = state;

  // Check for components that need verification
  const needsVerification: string[] = [];

  for (const [name, cs] of Object.entries(componentStates)) {
    if (cs.changeRole === 'no_change' || cs.changeRole === 'unknown') {
      continue;
    }

    // Has evidence (diff captured) but no verification run
    if (cs.diffPath && cs.changedFiles.length > 0) {
      const hasCommands = cs.commandResults && cs.commandResults.length > 0;
      if (!hasCommands) {
        needsVerification.push(name);
      }
    }
  }

  if (needsVerification.length > 0) {
    return {
      type: 'RUN_VERIFICATION',
      runId,
      reason: 'Evidence captured but verification not yet run',
      command: `sea verify ${runId} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  // Verification complete, check for artifact inspection
  return determineVerificationCompleteAction(state);
}

function determineVerificationCompleteAction(state: WorkspaceState): NextAction {
  const { runId, componentStates, brutalRealityCheck, finalDecision } = state;

  // Check if final decision exists
  if (finalDecision) {
    return {
      type: 'SHOW_REPORT',
      runId,
      reason: 'Final decision has been made',
      command: `sea report ${runId} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  // Check for components that need artifact inspection
  const needsArtifactInspection: string[] = [];

  for (const [name, cs] of Object.entries(componentStates)) {
    if (cs.changeRole === 'no_change' || cs.changeRole === 'unknown') {
      continue;
    }

    const component = state.workspace.components?.find(c => c.name === name);
    if (!component) continue;

    // Has artifact type configured but no inspection
    if (component.artifact?.type && component.artifact.type !== 'none') {
      if (!cs.artifactInspection) {
        needsArtifactInspection.push(name);
      }
    }
  }

  if (needsArtifactInspection.length > 0) {
    const component = needsArtifactInspection[0];
    return {
      type: 'INSPECT_ARTIFACT',
      runId,
      reason: `Artifact inspection needed for ${component}`,
      component,
      command: `sea inspect-artifact ${runId} -c ${component} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  // BRC not run yet but all evidence captured
  if (!brutalRealityCheck) {
    return {
      type: 'RESUME',
      runId,
      reason: 'All evidence captured, ready for final review',
      command: `sea resume ${runId} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  return {
    type: 'SHOW_REPORT',
    runId,
    reason: 'Run is ready for final report',
    command: `sea report ${runId} -w <workspace>`,
    canRunInteractively: true,
  };
}

/**
 * Get the next action for a specific component
 */
export function getNextActionForComponent(state: WorkspaceState, componentName: string): NextAction {
  const { runId, componentStates } = state;
  const cs = componentStates[componentName];

  if (!cs) {
    return {
      type: 'NONE',
      runId,
      reason: `Component ${componentName} not found in state`,
      canRunInteractively: false,
    };
  }

  // Check for diff capture
  if (!cs.diffPath || cs.changedFiles.length === 0) {
    if (cs.executorResult?.status === 'completed' || cs.executorResult?.status === 'manual_required') {
      return {
        type: 'CAPTURE_EVIDENCE',
        runId,
        reason: `${componentName} execution complete, capture evidence`,
        component: componentName,
        command: `sea after-execution ${runId} -c ${componentName} -w <workspace>`,
        canRunInteractively: true,
      };
    }
    return {
      type: 'OPEN_EXECUTION_REQUEST',
      runId,
      reason: `${componentName} needs execution request`,
      component: componentName,
      command: `sea request ${runId} -c ${componentName} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  // Has diff, check if verification needed
  if (!cs.commandResults || cs.commandResults.length === 0) {
    return {
      type: 'RUN_VERIFICATION',
      runId,
      reason: `${componentName} has changes, needs verification`,
      command: `sea verify ${runId} -w <workspace>`,
      canRunInteractively: true,
    };
  }

  return {
    type: 'NONE',
    runId,
    reason: `${componentName} verification complete`,
    canRunInteractively: false,
  };
}

/**
 * Build a summary of missing evidence for the run
 */
export function getMissingEvidence(state: WorkspaceState): string[] {
  const missing: string[] = [];
  const { componentStates } = state;

  for (const [name, cs] of Object.entries(componentStates)) {
    if (cs.changeRole === 'no_change' || cs.changeRole === 'unknown') {
      continue;
    }

    if (!cs.diffPath && cs.changedFiles.length === 0) {
      missing.push(`${name}: no diff captured`);
    } else if (!cs.commandResults || cs.commandResults.length === 0) {
      missing.push(`${name}: no verification commands run`);
    }
  }

  return missing;
}

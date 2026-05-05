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
        canRunInteractively: true,
      };

    case 'reviewing':
      return {
        type: 'RESUME',
        runId,
        reason: 'Run is in review phase, ready to continue',
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
      canRunInteractively: true,
    };
  }

  // BRC not run yet but all evidence captured
  if (!brutalRealityCheck) {
    return {
      type: 'RESUME',
      runId,
      reason: 'All evidence captured, ready for final review',
      canRunInteractively: true,
    };
  }

  return {
    type: 'SHOW_REPORT',
    runId,
    reason: 'Run is ready for final report',
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
        canRunInteractively: true,
      };
    }
    return {
      type: 'OPEN_EXECUTION_REQUEST',
      runId,
      reason: `${componentName} needs execution request`,
      component: componentName,
      canRunInteractively: true,
    };
  }

  // Has diff, check if verification needed
  if (!cs.commandResults || cs.commandResults.length === 0) {
    return {
      type: 'RUN_VERIFICATION',
      runId,
      reason: `${componentName} has changes, needs verification`,
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
 * Format a NextAction command string from action type and workspace path.
 * Never stores partial command strings — always computes fresh.
 */
export function formatNextActionCommand(action: NextAction, workspacePath: string): string {
  const w = ` -w ${workspacePath}`;
  switch (action.type) {
    case 'OPEN_EXECUTION_REQUEST':
      return `sea request ${action.runId} -c ${action.component}${w}`;
    case 'CAPTURE_EVIDENCE':
      return `sea after-execution ${action.runId} -c ${action.component}${w}`;
    case 'RUN_VERIFICATION':
      return `sea verify ${action.runId}${w}`;
    case 'INSPECT_ARTIFACT':
      return `sea inspect-artifact ${action.runId} -c ${action.component}${w}`;
    case 'SHOW_REPORT':
      return `sea report ${action.runId}${w}`;
    case 'RESUME':
      return `sea resume ${action.runId}${w}`;
    case 'FIX_BLOCKER':
      return `sea resume ${action.runId}${w}`;
    case 'NONE':
      return '';
    default:
      return `sea resume ${action.runId}${w}`;
  }
}

/**
 * Build a summary of missing evidence for the run.
 * Evidence requirements depend on the component's changeRole.
 */
export function getMissingEvidence(state: WorkspaceState): string[] {
  const missing: string[] = [];
  const { componentStates } = state;

  for (const [name, cs] of Object.entries(componentStates)) {
    switch (cs.changeRole) {
      case 'no_change':
      case 'unknown':
        break; // nothing expected
      case 'modify':
        if (!cs.diffPath && cs.changedFiles.length === 0) {
          missing.push(`${name}: no diff captured`);
        }
        if (!cs.commandResults || cs.commandResults.length === 0) {
          missing.push(`${name}: no verification commands run`);
        }
        break;
      case 'verify_only':
      case 'package_only':
        if (!cs.commandResults || cs.commandResults.length === 0) {
          missing.push(`${name}: no verification commands run`);
        }
        break;
      case 'artifact_verify':
        if (!cs.artifactInspection) {
          missing.push(`${name}: no artifact inspection`);
        }
        break;
      case 'blocked':
        missing.push(`${name}: blocked`);
        break;
    }
  }

  return missing;
}

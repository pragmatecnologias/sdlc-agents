/**
 * WorkflowStep union type for SEA workflow
 * Supports LangGraph-like primitives: sequence, parallel, condition, loop, approval
 */

import { WorkspaceState } from '../state/workspaceState.js';

export type WorkflowStepType = 'node' | 'sequence' | 'parallel' | 'condition' | 'loop' | 'approval';

/**
 * A workflow step that updates workspace state
 */
export type NodeStep = {
  type: 'node';
  id: string;
  run: (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
};

/**
 * A sequence of steps that run in order
 */
export type SequenceStep = {
  type: 'sequence';
  id?: string;
  steps: WorkflowStep[];
};

/**
 * Steps that run in parallel (with optional concurrency limit)
 */
export type ParallelStep = {
  type: 'parallel';
  id?: string;
  steps: WorkflowStep[];
  maxConcurrency?: number;
};

/**
 * Conditional routing - decides which step to run next based on state
 */
export type ConditionStep = {
  type: 'condition';
  id: string;
  decide: (state: WorkspaceState) => WorkflowStep;
};

/**
 * Loop that runs until condition is met or max attempts reached
 */
export type LoopStep = {
  type: 'loop';
  id: string;
  step: WorkflowStep;
  until: (state: WorkspaceState) => boolean;
  maxAttempts: number;
};

/**
 * Human approval step
 */
export type ApprovalStep = {
  type: 'approval';
  id: string;
  message: string;
  required: boolean;
};

/**
 * Union of all workflow step types
 */
export type WorkflowStep =
  | NodeStep
  | SequenceStep
  | ParallelStep
  | ConditionStep
  | LoopStep
  | ApprovalStep;

/**
 * Check if a step is a node
 */
export function isNodeStep(step: WorkflowStep): step is NodeStep {
  return step.type === 'node';
}

/**
 * Check if a step is a sequence
 */
export function isSequenceStep(step: WorkflowStep): step is SequenceStep {
  return step.type === 'sequence';
}

/**
 * Check if a step is parallel
 */
export function isParallelStep(step: WorkflowStep): step is ParallelStep {
  return step.type === 'parallel';
}

/**
 * Check if a step is a condition
 */
export function isConditionStep(step: WorkflowStep): step is ConditionStep {
  return step.type === 'condition';
}

/**
 * Check if a step is a loop
 */
export function isLoopStep(step: WorkflowStep): step is LoopStep {
  return step.type === 'loop';
}

/**
 * Check if a step is an approval
 */
export function isApprovalStep(step: WorkflowStep): step is ApprovalStep {
  return step.type === 'approval';
}

/**
 * Get step ID, using type as fallback
 */
export function getStepId(step: WorkflowStep): string {
  if ('id' in step && step.id) {
    return step.id;
  }
  return step.type;
}

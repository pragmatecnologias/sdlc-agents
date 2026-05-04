/**
 * WorkflowStep union type for SEA workflow
 * Supports LangGraph-like primitives: sequence, parallel, condition, loop, approval
 */
/**
 * Check if a step is a node
 */
export function isNodeStep(step) {
    return step.type === 'node';
}
/**
 * Check if a step is a sequence
 */
export function isSequenceStep(step) {
    return step.type === 'sequence';
}
/**
 * Check if a step is parallel
 */
export function isParallelStep(step) {
    return step.type === 'parallel';
}
/**
 * Check if a step is a condition
 */
export function isConditionStep(step) {
    return step.type === 'condition';
}
/**
 * Check if a step is a loop
 */
export function isLoopStep(step) {
    return step.type === 'loop';
}
/**
 * Check if a step is an approval
 */
export function isApprovalStep(step) {
    return step.type === 'approval';
}
/**
 * Get step ID, using type as fallback
 */
export function getStepId(step) {
    if ('id' in step && step.id) {
        return step.id;
    }
    return step.type;
}
//# sourceMappingURL=steps.js.map
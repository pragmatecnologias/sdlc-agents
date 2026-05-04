/**
 * Requirement Intake Agent for SEA
 * Converts raw user request into structured requirement report
 */
import { WorkspaceState } from '../state/workspaceState.js';
export interface RequirementIntakeOptions {
    llmClient?: LLMClient;
}
export interface LLMClient {
    complete(prompt: string): Promise<string>;
}
/**
 * Create the requirement intake agent function
 */
export declare function createRequirementIntakeAgent(options?: RequirementIntakeOptions): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=requirementIntakeAgent.d.ts.map
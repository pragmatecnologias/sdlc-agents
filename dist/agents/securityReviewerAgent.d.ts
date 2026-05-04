/**
 * Security Reviewer Agent for SEA
 * Reviews changes for security issues
 */
import { WorkspaceState } from '../state/workspaceState.js';
/**
 * Create the security reviewer agent function
 */
export declare function createSecurityReviewerAgent(): (state: WorkspaceState) => Promise<Partial<WorkspaceState>>;
//# sourceMappingURL=securityReviewerAgent.d.ts.map
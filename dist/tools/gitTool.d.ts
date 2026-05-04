/**
 * Git Tool for SEA
 * Provides git operations: status, diff, branch
 */
export interface GitStatus {
    isRepo: boolean;
    currentBranch: string;
    isDirty: boolean;
    staged: string[];
    modified: string[];
    untracked: string[];
    deleted: string[];
}
export interface GitDiff {
    raw: string;
    files: string[];
    insertions: number;
    deletions: number;
}
/**
 * Get git status for a directory
 */
export declare function getGitStatus(repoPath: string): Promise<GitStatus>;
/**
 * Get git diff for a directory
 */
export declare function getGitDiff(repoPath: string, file?: string): Promise<GitDiff>;
/**
 * Get staged diff
 */
export declare function getStagedDiff(repoPath: string): Promise<GitDiff>;
/**
 * Create a new branch
 */
export declare function createBranch(repoPath: string, branchName: string): Promise<boolean>;
/**
 * Get list of branches
 */
export declare function getBranches(repoPath: string): Promise<string[]>;
/**
 * Checkout a branch
 */
export declare function checkoutBranch(repoPath: string, branchName: string): Promise<boolean>;
/**
 * Stage files
 */
export declare function stageFiles(repoPath: string, files: string[]): Promise<boolean>;
/**
 * Commit changes
 */
export declare function commit(repoPath: string, message: string): Promise<string | null>;
/**
 * Get current commit hash
 */
export declare function getCurrentCommit(repoPath: string): Promise<string | null>;
/**
 * Save git status to a file
 */
export declare function saveGitStatusToFile(repoPath: string, outputPath: string): Promise<void>;
/**
 * Save git diff to a file
 */
export declare function saveGitDiffToFile(repoPath: string, outputPath: string, file?: string): Promise<void>;
//# sourceMappingURL=gitTool.d.ts.map
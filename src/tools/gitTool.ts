/**
 * Git Tool for SEA
 * Provides git operations: status, diff, branch
 */

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GitTool');

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
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  const git = simpleGit(repoPath);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        isRepo: false,
        currentBranch: '',
        isDirty: false,
        staged: [],
        modified: [],
        untracked: [],
        deleted: [],
      };
    }

    const status: StatusResult = await git.status();

    return {
      isRepo: true,
      currentBranch: status.current || 'HEAD',
      isDirty: status.isClean() === false,
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      deleted: status.deleted,
    };
  } catch (error) {
    logger.error(`Failed to get git status for ${repoPath}:`, error);
    return {
      isRepo: false,
      currentBranch: '',
      isDirty: false,
      staged: [],
      modified: [],
      untracked: [],
      deleted: [],
    };
  }
}

/**
 * Get git diff for a directory
 */
export async function getGitDiff(repoPath: string, file?: string): Promise<GitDiff> {
  const git = simpleGit(repoPath);

  try {
    const options = file ? [file] : [];
    const raw = await git.diff(options);

    // Parse diff to count insertions/deletions
    const lines = raw.split('\n');
    let insertions = 0;
    let deletions = 0;
    const files = new Set<string>();

    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        const match = line.match(/^[+-]{3} [ab]\/(.+)/);
        if (match) {
          files.add(match[1]);
        }
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      raw,
      files: Array.from(files),
      insertions,
      deletions,
    };
  } catch (error) {
    logger.error(`Failed to get git diff for ${repoPath}:`, error);
    return { raw: '', files: [], insertions: 0, deletions: 0 };
  }
}

/**
 * Get staged diff
 */
export async function getStagedDiff(repoPath: string): Promise<GitDiff> {
  const git = simpleGit(repoPath);

  try {
    const raw = await git.diff(['--staged']);
    const lines = raw.split('\n');
    let insertions = 0;
    let deletions = 0;
    const files = new Set<string>();

    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        const match = line.match(/^[+-]{3} [ab]\/(.+)/);
        if (match) {
          files.add(match[1]);
        }
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return { raw, files: Array.from(files), insertions, deletions };
  } catch (error) {
    logger.error(`Failed to get staged diff for ${repoPath}:`, error);
    return { raw: '', files: [], insertions: 0, deletions: 0 };
  }
}

/**
 * Create a new branch
 */
export async function createBranch(repoPath: string, branchName: string): Promise<boolean> {
  const git = simpleGit(repoPath);

  try {
    await git.checkoutLocalBranch(branchName);
    logger.info(`Created branch: ${branchName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to create branch ${branchName}:`, error);
    return false;
  }
}

/**
 * Get list of branches
 */
export async function getBranches(repoPath: string): Promise<string[]> {
  const git = simpleGit(repoPath);

  try {
    const branches = await git.branchLocal();
    return branches.all;
  } catch (error) {
    logger.error(`Failed to get branches for ${repoPath}:`, error);
    return [];
  }
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(repoPath: string, branchName: string): Promise<boolean> {
  const git = simpleGit(repoPath);

  try {
    await git.checkout(branchName);
    logger.info(`Checked out branch: ${branchName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to checkout branch ${branchName}:`, error);
    return false;
  }
}

/**
 * Stage files
 */
export async function stageFiles(repoPath: string, files: string[]): Promise<boolean> {
  const git = simpleGit(repoPath);

  try {
    await git.add(files);
    logger.info(`Staged files: ${files.join(', ')}`);
    return true;
  } catch (error) {
    logger.error(`Failed to stage files:`, error);
    return false;
  }
}

/**
 * Commit changes
 */
export async function commit(repoPath: string, message: string): Promise<string | null> {
  const git = simpleGit(repoPath);

  try {
    const result = await git.commit(message);
    logger.info(`Committed: ${result.commit}`);
    return result.commit;
  } catch (error) {
    logger.error(`Failed to commit:`, error);
    return null;
  }
}

/**
 * Get current commit hash
 */
export async function getCurrentCommit(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath);

  try {
    const hash = await git.revparse(['HEAD']);
    return hash.trim();
  } catch {
    return null;
  }
}

/**
 * Save git status to a file
 */
export async function saveGitStatusToFile(
  repoPath: string,
  outputPath: string
): Promise<void> {
  const status = await getGitStatus(repoPath);
  const content = JSON.stringify(status, null, 2);
  await fs.writeFile(outputPath, content, 'utf-8');
}

/**
 * Save git diff to a file
 */
export async function saveGitDiffToFile(
  repoPath: string,
  outputPath: string,
  file?: string
): Promise<void> {
  const diff = await getGitDiff(repoPath, file);
  await fs.writeFile(outputPath, diff.raw, 'utf-8');
}

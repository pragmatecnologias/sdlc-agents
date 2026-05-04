/**
 * Git Tool for SEA
 * Provides git operations: status, diff, branch, snapshots
 */

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GitTool');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface GitSnapshot {
  branch: string;
  commitHash: string;
  isDirty: boolean;
  changedFiles: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that `repoPath` points to a real git repository.
 * Returns a configured SimpleGit instance.
 * Throws a descriptive Error when validation fails.
 */
async function requireRepo(repoPath: string): Promise<SimpleGit> {
  const resolved = path.resolve(repoPath);
  const git = simpleGit(resolved);

  let isRepo: boolean;
  try {
    isRepo = await git.checkIsRepo();
  } catch (err: unknown) {
    throw new Error(
      `Cannot check repository status at "${resolved}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!isRepo) {
    throw new Error(`"${resolved}" is not a valid git repository`);
  }

  return git;
}

/**
 * Parse a raw unified-diff string and extract file names, insertion count,
 * and deletion count.
 */
function parseDiffSummary(raw: string): { files: string[]; insertions: number; deletions: number } {
  const lines = raw.split('\n');
  const files = new Set<string>();
  let insertions = 0;
  let deletions = 0;

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

  return { files: Array.from(files), insertions, deletions };
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Get git status for a directory.
 *
 * Returns a zero-value `GitStatus` with `isRepo: false` when the path is not a
 * valid git repository (instead of throwing) so callers can use this as a
 * lightweight probe.  All other callers that *expect* a repo should use the
 * newer functions which throw on invalid paths.
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  try {
    const git = await requireRepo(repoPath);
    const status: StatusResult = await git.status(['--', '.']);

    return {
      isRepo: true,
      currentBranch: status.current || 'HEAD',
      isDirty: !status.isClean(),
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      deleted: status.deleted,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`getGitStatus: ${msg}`);
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
 * Get unstaged (working-tree) diff for a directory.
 * Optionally scoped to a single `file`.
 */
export async function getGitDiff(repoPath: string, file?: string): Promise<GitDiff> {
  const git = await requireRepo(repoPath);
  const options: string[] = file ? [file] : [];
  const raw = await git.diff(options);
  const { files, insertions, deletions } = parseDiffSummary(raw);
  return { raw, files, insertions, deletions };
}

/**
 * Get staged (index) diff for a directory.
 */
export async function getStagedDiff(repoPath: string): Promise<GitDiff> {
  const git = await requireRepo(repoPath);
  const raw = await git.diff(['--staged']);
  const { files, insertions, deletions } = parseDiffSummary(raw);
  return { raw, files, insertions, deletions };
}

// ---------------------------------------------------------------------------
// NEW: Full diff, changed files, snapshot, diff between commits
// ---------------------------------------------------------------------------

/**
 * Return a combined diff of **staged + unstaged** changes (everything that
 * differs from HEAD), together with file names and insertion/deletion counts.
 */
export async function getFullDiff(repoPath: string): Promise<GitDiff> {
  const git = await requireRepo(repoPath);

  // First capture staged changes, then overlay unstaged on top.
  // `git diff HEAD` does exactly this in one call (staged + unstaged),
  // but for untracked files we need `--no-index /dev/null <file>` or
  // `git add --intent-to-add` — instead we ask simple-git for status and
  // concatenate untracked-file diffs manually.
  // Capture staged + unstaged diffs SCOPED to this component directory (.)
  // Without pathspec, simpleGit discovers parent repo at workspace root
  // and returns ALL changes across the entire workspace.
  const [stagedRaw, unstagedRaw, status] = await Promise.all([
    git.diff(['--staged', '--', '.']),
    git.diff(['--', '.']),
    git.status(['--', '.']),
  ]);

  let raw = stagedRaw;

  // Append unstaged changes that are not already fully represented by the
  // staged diff (simple-git `diff()` returns unstaged only, not staged).
  // To avoid duplication we only append when the unstaged diff is non-empty
  // and contains content not in the staged diff.
  if (unstagedRaw && !stagedRaw.includes(unstagedRaw)) {
    raw += unstagedRaw;
  }

  // For untracked files, generate a diff-style header so they appear in
  // the file list even though they have no previous revision.
  const untracked = status.not_added;
  for (const file of untracked) {
    raw += `\n--- /dev/null\n+++ b/${file}\n`;
  }

  const { files, insertions, deletions } = parseDiffSummary(raw);
  return { raw, files, insertions, deletions };
}

/**
 * Return a simple array of file names that have changed relative to HEAD:
 * modified (staged or unstaged), deleted, and untracked.
 */
export async function getChangedFiles(repoPath: string): Promise<string[]> {
  const git = await requireRepo(repoPath);
  const status: StatusResult = await git.status(['--', '.']);

  // Use a Set to deduplicate — a file can appear in both staged and modified.
  const changed = new Set<string>();
  for (const f of status.staged) changed.add(f);
  for (const f of status.modified) changed.add(f);
  for (const f of status.not_added) changed.add(f);
  for (const f of status.deleted) changed.add(f);
  for (const f of status.conflicted) changed.add(f);

  return Array.from(changed).sort();
}

/**
 * Return changed files between two commits (exclusive of `from`, inclusive of
 * `to`).
 */
export async function getDiffBetweenCommits(
  repoPath: string,
  from: string,
  to: string
): Promise<GitDiff> {
  const git = await requireRepo(repoPath);
  const raw = await git.diff([`${from}..${to}`]);
  const { files, insertions, deletions } = parseDiffSummary(raw);
  return { raw, files, insertions, deletions };
}

/**
 * Capture a point-in-time snapshot of the repository state: branch, commit
 * hash, dirty flag, and the full list of changed files.
 */
export async function captureSnapshot(repoPath: string): Promise<GitSnapshot> {
  const git = await requireRepo(repoPath);

  const [status, commitHash] = await Promise.all([
    git.status(),
    git.revparse(['HEAD']).then((h) => h.trim()),
  ]);

  const changedFiles = await getChangedFiles(repoPath);

  return {
    branch: status.current || 'HEAD',
    commitHash,
    isDirty: !status.isClean(),
    changedFiles,
  };
}

// ---------------------------------------------------------------------------
// Branch operations
// ---------------------------------------------------------------------------

/**
 * Create a new local branch and check it out.
 */
export async function createBranch(repoPath: string, branchName: string): Promise<boolean> {
  const git = await requireRepo(repoPath);
  await git.checkoutLocalBranch(branchName);
  logger.info(`Created branch: ${branchName}`);
  return true;
}

/**
 * Get list of local branches.
 */
export async function getBranches(repoPath: string): Promise<string[]> {
  const git = await requireRepo(repoPath);
  const branches = await git.branchLocal();
  return branches.all;
}

/**
 * Checkout a branch (local or remote-tracking).
 */
export async function checkoutBranch(repoPath: string, branchName: string): Promise<boolean> {
  const git = await requireRepo(repoPath);
  await git.checkout(branchName);
  logger.info(`Checked out branch: ${branchName}`);
  return true;
}

// ---------------------------------------------------------------------------
// Staging & committing
// ---------------------------------------------------------------------------

/**
 * Stage files (add to the index).
 */
export async function stageFiles(repoPath: string, files: string[]): Promise<boolean> {
  const git = await requireRepo(repoPath);
  await git.add(files);
  logger.info(`Staged files: ${files.join(', ')}`);
  return true;
}

/**
 * Commit all staged changes.
 * Returns the commit hash.
 */
export async function commit(repoPath: string, message: string): Promise<string | null> {
  const git = await requireRepo(repoPath);
  const result = await git.commit(message);
  logger.info(`Committed: ${result.commit}`);
  return result.commit;
}

/**
 * Get the current HEAD commit hash.
 */
export async function getCurrentCommit(repoPath: string): Promise<string | null> {
  const git = await requireRepo(repoPath);
  const hash = await git.revparse(['HEAD']);
  return hash.trim();
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

/**
 * Save git status to a JSON file.
 */
export async function saveGitStatusToFile(
  repoPath: string,
  outputPath: string
): Promise<void> {
  const status = await getGitStatus(repoPath);
  await fs.writeFile(outputPath, JSON.stringify(status, null, 2), 'utf-8');
}

/**
 * Save git diff to files on disk.
 *
 * Writes two files side-by-side:
 *   - `<outputPath>`         — the raw unified diff text
 *   - `<outputPath>.meta.json` — structured metadata (files, insertions,
 *                                 deletions) as JSON
 *
 * When `outputPath` has no extension (e.g. `/tmp/diff`), the raw file keeps
 * the original name and metadata is written to `/tmp/diff.meta.json`.
 */
export async function saveGitDiffToFile(
  repoPath: string,
  outputPath: string,
  file?: string
): Promise<void> {
  // When scoped to a single file, use getGitDiff; otherwise get everything.
  const diff = file
    ? await getGitDiff(repoPath, file)
    : await getFullDiff(repoPath);

  // Write raw diff text
  await fs.writeFile(outputPath, diff.raw, 'utf-8');

  // Write structured metadata alongside
  const metaPath = outputPath.endsWith('.meta.json')
    ? outputPath
    : `${outputPath}.meta.json`;

  const metadata = {
    files: diff.files,
    insertions: diff.insertions,
    deletions: diff.deletions,
    totalFiles: diff.files.length,
  };
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

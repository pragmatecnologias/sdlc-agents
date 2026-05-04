/**
 * Test utilities for creating temporary workspaces from fixture directories.
 *
 * Each call to `createTempWorkspace` produces a fresh copy of a fixture in the
 * OS temp directory, initialises a git repo inside it, and returns the path
 * to the temporary workspace.  Callers are responsible for cleaning up.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

/**
 * Absolute path to the `tests/fixtures` directory.
 */
export const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

/**
 * Copy a fixture directory to a temp location and initialise a git repo.
 *
 * Skips any nested `.git` directories from the source fixture so that the
 * temp workspace always starts with a brand-new repository.
 *
 * @param fixtureName  Name of a subdirectory inside `tests/fixtures/`
 *                     (e.g. `'single-frontend'`, `'war-composite'`).
 * @returns Absolute path to the temporary workspace directory.
 */
export async function createTempWorkspace(fixtureName: string): Promise<string> {
  const srcDir = path.join(FIXTURES_DIR, fixtureName);

  if (!fsSync.existsSync(srcDir)) {
    throw new Error(`Fixture directory does not exist: ${srcDir}`);
  }

  // Create a unique temp directory
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), `sea-test-${fixtureName}-`));

  // Recursively copy the fixture into the temp directory, skipping .git dirs
  await copyDir(srcDir, tmpRoot);

  // Initialise a fresh git repo and make an initial commit
  await exec('git init', { cwd: tmpRoot });
  await exec('git add -A', { cwd: tmpRoot });
  await exec('git commit -m "Initial commit"', { cwd: tmpRoot });

  return tmpRoot;
}

/**
 * Recursively copy a directory, skipping `.git` directories.
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip .git directories so each temp workspace gets a fresh repo
    if (entry.name === '.git') {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Remove a temporary workspace directory (best-effort cleanup).
 */
export async function cleanupTempWorkspace(tmpDir: string): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

/**
 * Write a file relative to a workspace root.  Creates intermediate directories
 * as needed.
 */
export async function writeFile(workspaceRoot: string, relativePath: string, content: string): Promise<string> {
  const fullPath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
  return fullPath;
}

/**
 * Append content to a file relative to a workspace root.
 */
export async function appendFile(workspaceRoot: string, relativePath: string, content: string): Promise<string> {
  const fullPath = path.join(workspaceRoot, relativePath);
  await fs.appendFile(fullPath, content, 'utf-8');
  return fullPath;
}

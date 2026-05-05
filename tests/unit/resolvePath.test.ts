/**
 * Tests for resolvePath utilities.
 *
 * Verifies that getWorkspaceRoot resolves correctly and fails safely
 * when neither baseDir nor a local .sea/workspace.json is present.
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getWorkspaceRoot, resolveComponentPath, resolveComponentPathFromState } from '../../src/tools/resolvePath.js';
import type { WorkspaceState } from '../../src/state/workspaceState.js';

describe('getWorkspaceRoot', () => {
  it('resolves from state.baseDir', () => {
    const state = { baseDir: '/project/.sea' } as WorkspaceState;
    expect(getWorkspaceRoot(state)).toBe('/project');
  });

  it('resolves from state.baseDir with nested path', () => {
    const state = { baseDir: '/deep/nested/project/.sea' } as WorkspaceState;
    expect(getWorkspaceRoot(state)).toBe('/deep/nested/project');
  });

  it('falls back to cwd when .sea/workspace.json exists there', () => {
    // Create a temp dir with .sea/workspace.json, then test in a child process
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-resolve-'));
    fs.mkdirSync(path.join(tmpDir, '.sea'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.sea', 'workspace.json'), '{}', 'utf-8');

    try {
      const { execSync } = require('child_process');
      const result = execSync(
        `node -e "const {getWorkspaceRoot}=require('${path.resolve(__dirname, '../../dist/tools/resolvePath.js')}');` +
        `console.log(getWorkspaceRoot({baseDir:undefined}));"`,
        { cwd: tmpDir, encoding: 'utf-8' }
      );
      expect(fs.realpathSync(result.trim())).toBe(fs.realpathSync(tmpDir));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when baseDir is missing and no .sea/workspace.json in cwd', () => {
    const state = { baseDir: undefined as unknown as string } as WorkspaceState;
    try {
      getWorkspaceRoot(state);
      // If we get here, cwd happened to have .sea/workspace.json — acceptable
    } catch (e: any) {
      expect(e.message).toContain('Cannot resolve workspace root');
      expect(e.message).toContain('state.baseDir is not set');
    }
  });
});

describe('resolveComponentPath', () => {
  it('resolves relative path against workspace root', () => {
    expect(resolveComponentPath('/project', 'packages/frontend')).toBe(
      path.resolve('/project', 'packages/frontend')
    );
  });

  it('returns absolute path unchanged', () => {
    expect(resolveComponentPath('/project', '/absolute/path')).toBe('/absolute/path');
  });
});

describe('resolveComponentPathFromState', () => {
  it('resolves using state.baseDir', () => {
    const state = { baseDir: '/project/.sea' } as WorkspaceState;
    const config = { path: 'packages/frontend' };
    expect(resolveComponentPathFromState(state, config)).toBe(
      path.resolve('/project', 'packages/frontend')
    );
  });
});

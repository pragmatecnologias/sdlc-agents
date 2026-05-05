/**
 * Tests for rollback module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  previewRollback,
  formatRollbackPreview,
} from '../../src/tools/rollback.js';
import { loadState } from '../../src/workflow/checkpoint.js';
import { execSync } from 'child_process';

const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

describe('previewRollback', () => {
  it('returns empty for run with no changes', async () => {
    // Preview of a non-existent run should return empty
    // (actual rollback targets would come from real runs)
    const targets = await previewRollback('run-nonexistent', path.join(FIXTURE, '.sea'));
    expect(targets).toEqual([]);
  });
});

describe('formatRollbackPreview', () => {
  it('shows no targets message when list is empty', () => {
    const output = formatRollbackPreview([]);
    expect(output).toContain('No rollback targets');
  });

  it('includes component names when targets exist', () => {
    const targets = [
      {
        componentName: 'ui',
        componentPath: '/fake/path/ui',
        diffPath: '/fake/path/ui/diff.patch',
        changedFiles: ['src/App.tsx', 'src/index.ts'],
        branchBefore: 'main',
        headBefore: null,
      },
    ];

    const output = formatRollbackPreview(targets);
    expect(output).toContain('ui');
    expect(output).toContain('/fake/path/ui/diff.patch');
  });

  it('shows changed file list', () => {
    const targets = [
      {
        componentName: 'backend',
        componentPath: '/fake/backend',
        diffPath: null,
        changedFiles: ['src/main.ts', 'src/config.ts', 'package.json'],
        branchBefore: null,
        headBefore: null,
      },
    ];

    const output = formatRollbackPreview(targets);
    expect(output).toContain('backend');
    expect(output).toContain('src/main.ts');
    expect(output).toContain('src/config.ts');
  });
});
/**
 * Tests for validate-workspace command.
 *
 * Verifies WAR_COMPOSITE_APP-specific validation:
 * - Requires outputPath/outputGlob for WAR artifacts
 * - Warns if requiredEntries missing
 * - Fails on unknown dependencies
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CLI = path.resolve(__dirname, '../../dist/index.js');
const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

function runCli(args: string, cwd: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

function runCliFails(args: string, cwd: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
  } catch (err: any) {
    return ((err.stdout || '') + (err.stderr || '')) || String(err);
  }
}

async function createTmpWorkspace(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-validate-'));
  await fs.cp(FIXTURE, tmpDir, { recursive: true });
  return tmpDir;
}

beforeAll(async () => {
  execSync('npm run build', {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf-8',
    timeout: 30000,
  });
});

describe('validate-workspace for WAR_COMPOSITE_APP', () => {
  it('passes validation for valid WAR_COMPOSITE_APP workspace', async () => {
    const tmpDir = await createTmpWorkspace();
    try {
      const workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
      const output = runCli(`validate-workspace -w ${workspacePath}`, tmpDir);
      expect(output).toContain('Validation PASSED');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('warns when requiredEntries is missing for WAR artifact', async () => {
    const tmpDir = await createTmpWorkspace();
    try {
      const workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
      const config = JSON.parse(readFileSync(workspacePath, 'utf-8'));
      const warBuilder = config.components.find((c: any) => c.name === 'war-builder');
      delete warBuilder.artifact.requiredEntries;
      writeFileSync(workspacePath, JSON.stringify(config, null, 2));

      const output = runCli(`validate-workspace -w ${workspacePath}`, tmpDir);
      expect(output).toContain('WARN');
      expect(output).toContain('requiredEntries');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails when dependency references unknown component', async () => {
    const tmpDir = await createTmpWorkspace();
    try {
      const workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
      const config = JSON.parse(readFileSync(workspacePath, 'utf-8'));
      const warBuilder = config.components.find((c: any) => c.name === 'war-builder');
      warBuilder.dependencies.push('nonexistent-component');
      writeFileSync(workspacePath, JSON.stringify(config, null, 2));

      const output = runCliFails(`validate-workspace -w ${workspacePath}`, tmpDir);
      expect(output).toContain('FAIL');
      expect(output).toContain('nonexistent-component');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails when WAR artifact has no outputPath or outputGlob', async () => {
    const tmpDir = await createTmpWorkspace();
    try {
      const workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
      const config = JSON.parse(readFileSync(workspacePath, 'utf-8'));
      const warBuilder = config.components.find((c: any) => c.name === 'war-builder');
      delete warBuilder.artifact.outputPath;
      delete warBuilder.artifact.outputGlob;
      writeFileSync(workspacePath, JSON.stringify(config, null, 2));

      const output = runCliFails(`validate-workspace -w ${workspacePath}`, tmpDir);
      expect(output).toContain('FAIL');
      expect(output).toContain('outputPath or outputGlob');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('shows component count and profile in output', async () => {
    const tmpDir = await createTmpWorkspace();
    try {
      const workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
      const output = runCli(`validate-workspace -w ${workspacePath}`, tmpDir);
      expect(output).toContain('Components:        3');
      expect(output).toContain('WAR_COMPOSITE_APP');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

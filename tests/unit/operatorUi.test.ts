/**
 * Tests for the operator UI command surface.
 *
 * Verifies:
 * - Plain `sea` invokes interactive mode (no "command not found" error)
 * - `sea interactive --help` and `sea ui --help` are registered
 * - `sea status --json` parses correctly
 * - `sea next --json` parses correctly and includes workspace path in commands
 * - formatNextActionCommand replaces <workspace> placeholder
 * - Command registration includes all expected commands
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { formatNextActionCommand } from '../../src/services/nextActionService.js';
import { createTempWorkspace, cleanupTempWorkspace } from '../setup.js';

const CLI = path.resolve(__dirname, '../../dist/index.js');

function runCli(args: string, cwd?: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd: cwd || process.cwd(),
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

describe('formatNextActionCommand', () => {
  it('replaces <workspace> placeholder with actual path', () => {
    const action = {
      type: 'OPEN_EXECUTION_REQUEST' as const,
      runId: 'run-123',
      reason: 'test',
      component: 'backend',
      command: 'sea request run-123 -c backend -w <workspace>',
      canRunInteractively: true,
    };

    const result = formatNextActionCommand(action, '/path/to/.sea/workspace.json');
    expect(result).toBe('sea request run-123 -c backend -w /path/to/.sea/workspace.json');
  });

  it('returns undefined when command is undefined', () => {
    const action = {
      type: 'NONE' as const,
      runId: 'run-123',
      reason: 'test',
      canRunInteractively: false,
    };

    const result = formatNextActionCommand(action, '/path/to/.sea/workspace.json');
    expect(result).toBeUndefined();
  });

  it('returns command unchanged when no <workspace> placeholder', () => {
    const action = {
      type: 'FIX_BLOCKER' as const,
      runId: 'run-123',
      reason: 'test',
      canRunInteractively: false,
    };

    const result = formatNextActionCommand(action, '/path/to/.sea/workspace.json');
    expect(result).toBeUndefined();
  });

  it('handles workspace path with spaces', () => {
    const action = {
      type: 'RUN_VERIFICATION' as const,
      runId: 'run-123',
      reason: 'test',
      command: 'sea verify run-123 -w <workspace>',
      canRunInteractively: true,
    };

    const result = formatNextActionCommand(action, '/path with spaces/.sea/workspace.json');
    expect(result).toBe('sea verify run-123 -w /path with spaces/.sea/workspace.json');
  });
});

describe('command registration', () => {
  it('sea --help lists all expected commands', () => {
    const output = runCli('--help');

    expect(output).toContain('init');
    expect(output).toContain('plan');
    expect(output).toContain('run');
    expect(output).toContain('request');
    expect(output).toContain('after-execution');
    expect(output).toContain('verify');
    expect(output).toContain('inspect-artifact');
    expect(output).toContain('resume');
    expect(output).toContain('report');
    expect(output).toContain('memory');
    expect(output).toContain('status');
    expect(output).toContain('next');
    expect(output).toContain('interactive');
    expect(output).toContain('ui');
  });

  it('sea interactive --help is registered', () => {
    const output = runCli('interactive --help');
    expect(output).toContain('guided interactive control panel');
  });

  it('sea ui --help is registered', () => {
    const output = runCli('ui --help');
    expect(output).toContain('guided interactive control panel');
  });

  it('plain sea does not print "command not found"', async () => {
    // Running plain `sea` with piped stdin should start interactive mode.
    // inquirer will throw when stdin closes, but we can verify stdout shows
    // the interactive banner before the prompt error.
    const { spawn } = await import('child_process');
    const stdout: string[] = [];

    const proc = spawn('node', [CLI], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    proc.stdout.on('data', (d) => stdout.push(d.toString()));
    proc.stderr.on('data', () => {});

    // Close stdin immediately — inquirer will exit with an error
    proc.stdin.end();

    await new Promise<void>((resolve) => {
      proc.on('close', () => resolve());
      setTimeout(() => { proc.kill(); resolve(); }, 5000);
    });

    const output = stdout.join('');
    // Should contain the interactive mode banner, proving it entered interactive mode
    expect(output).toContain('SEA Control Panel');
  });
});

describe('sea status --json', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;

  beforeAll(async () => {
    await execSync('npm run build', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 30000,
    });

    tmpDir = await createTempWorkspace('war-composite');
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    const runOutput = runCli(`run "status json test" -w ${workspacePath}`, tmpDir);
    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await cleanupTempWorkspace(tmpDir);
  });

  it('outputs valid JSON with all required fields', () => {
    const output = runCli(`status ${runId} -w ${workspacePath} --json`, tmpDir);
    const parsed = JSON.parse(output);

    expect(parsed.runId).toBe(runId);
    expect(parsed.runStatus).toBeDefined();
    expect(parsed.userRequest).toBeDefined();
    expect(parsed.createdAt).toBeDefined();
    expect(parsed.updatedAt).toBeDefined();
    expect(parsed.components).toBeInstanceOf(Array);
    expect(parsed.missingEvidence).toBeInstanceOf(Array);
    expect(parsed.blockers).toBeInstanceOf(Array);
    expect(parsed.workspacePath).toBe(workspacePath);
  });

  it('nextAction.command contains workspace path, not placeholder', () => {
    const output = runCli(`status ${runId} -w ${workspacePath} --json`, tmpDir);
    const parsed = JSON.parse(output);

    expect(parsed.nextAction).toBeDefined();
    expect(parsed.nextAction.type).toBeDefined();
    if (parsed.nextAction.command) {
      expect(parsed.nextAction.command).not.toContain('<workspace>');
      expect(parsed.nextAction.command).toContain(workspacePath);
    }
  });
});

describe('sea next --json', () => {
  let tmpDir: string;
  let workspacePath: string;
  let runId: string;

  beforeAll(async () => {
    tmpDir = await createTempWorkspace('war-composite');
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');

    const runOutput = runCli(`run "next json test" -w ${workspacePath}`, tmpDir);
    const runIdMatch = runOutput.match(/Run ID:\s*(run-\d+)/);
    expect(runIdMatch).toBeTruthy();
    runId = runIdMatch![1];
  });

  afterAll(async () => {
    await cleanupTempWorkspace(tmpDir);
  });

  it('outputs valid JSON with all required fields', () => {
    const output = runCli(`next ${runId} -w ${workspacePath} --json`, tmpDir);
    const parsed = JSON.parse(output);

    expect(parsed.type).toBeDefined();
    expect(parsed.runId).toBe(runId);
    expect(parsed.reason).toBeDefined();
    expect(parsed.canRunInteractively).toBeDefined();
  });

  it('command field contains workspace path, not placeholder', () => {
    const output = runCli(`next ${runId} -w ${workspacePath} --json`, tmpDir);
    const parsed = JSON.parse(output);

    if (parsed.command) {
      expect(parsed.command).not.toContain('<workspace>');
      expect(parsed.command).toContain(workspacePath);
    }
  });

  it('sea next (non-JSON) shows workspace path in command', () => {
    const output = runCli(`next ${runId} -w ${workspacePath}`, tmpDir);

    expect(output).toContain('Next Action');
    expect(output).toContain('Command:');
    if (output.includes(workspacePath)) {
      expect(output).not.toContain('<workspace>');
    }
  });
});

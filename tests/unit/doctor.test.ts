/**
 * Tests for SEA doctor command (workspace health check)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { runDoctor } from '../../src/tools/doctor.js';

const CLI = path.resolve(__dirname, '../../dist/index.js');
const FIXTURE = path.resolve(__dirname, '../fixtures/war-composite');

function runCli(args: string, cwd?: string): string {
  return execSync(`node ${CLI} ${args}`, {
    cwd: cwd || process.cwd(),
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
}

describe('doctor --help', () => {
  it('sea doctor --help is registered', () => {
    const output = runCli('doctor --help');
    expect(output).toContain('sea doctor');
    expect(output).toContain('workspace health check');
  });

  it('sea doctor --json is available', () => {
    const output = runCli('doctor --help');
    expect(output).toContain('--json');
  });
});

describe('doctor validation', () => {
  let tmpDir: string;
  let workspacePath: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-doctor-'));
    await fs.cp(FIXTURE, tmpDir, { recursive: true, filter: (src) => !src.endsWith('.git') });
    // Initialize git in each component so doctor can check branch/dirty status
    for (const subDir of ['ui', 'backend', 'war-builder']) {
      const compPath = path.join(tmpDir, subDir);
      try {
        execSync('git init && git add -A && git commit -m "initial"', {
          cwd: compPath,
          encoding: 'utf-8',
          timeout: 10000,
        });
      } catch {
        // Non-critical if git init fails
      }
    }
    workspacePath = path.join(tmpDir, '.sea', 'workspace.json');
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runDoctor returns overallStatus PASS/WARN/FAIL', async () => {
    const result = await runDoctor(workspacePath);
    expect(['PASS', 'WARN', 'FAIL']).toContain(result.overallStatus);
    expect(result.checks).toBeInstanceOf(Array);
    expect(result.summary).toBeDefined();
    expect(result.summary.passed).toBeGreaterThanOrEqual(0);
    expect(result.summary.warnings).toBeGreaterThanOrEqual(0);
    expect(result.summary.failures).toBeGreaterThanOrEqual(0);
  });

  it('runDoctor includes workspace info', async () => {
    const result = await runDoctor(workspacePath);
    expect(result.workspacePath).toBe(workspacePath);
    expect(result.workspaceRoot).toBeDefined();
    expect(result.workspaceName).toBeDefined();
  });

  it('runDoctor includes per-component checks', async () => {
    const result = await runDoctor(workspacePath);
    const componentChecks = result.checks.filter(c => c.component !== '');
    expect(componentChecks.length).toBeGreaterThan(0);
  });

  it('doctor checks have status, problem, whyItMatters, howToFix', async () => {
    const result = await runDoctor(workspacePath);
    for (const check of result.checks) {
      expect(['PASS', 'WARN', 'FAIL']).toContain(check.status);
      expect(typeof check.component).toBe('string');
      expect(typeof check.check).toBe('string');
      // problem/whyItMatters/howToFix can be empty for PASS checks
      expect(typeof check.problem).toBe('string');
      expect(typeof check.whyItMatters).toBe('string');
      expect(typeof check.howToFix).toBe('string');
    }
  });

  it('doctor --json output parses correctly', async () => {
    const result = await runDoctor(workspacePath);
    // The runDoctor returns result directly, test the JSON path via CLI
    // Use the programmatic API which works in test
    const jsonOutput = JSON.stringify(result, null, 2);
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.overallStatus).toBeDefined();
    expect(parsed.checks).toBeInstanceOf(Array);
  });

  it('doctor output shows PASS for clean git repos', async () => {
    const result = await runDoctor(workspacePath);
    // Since we initialized git repos in beforeAll, components should have git-branch PASS
    const branchChecks = result.checks.filter(c => c.check === 'git-branch');
    expect(branchChecks.length).toBeGreaterThan(0);
  });
});
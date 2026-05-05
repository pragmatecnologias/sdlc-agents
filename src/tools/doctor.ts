/**
 * SEA Doctor - Comprehensive Workspace Health Check
 *
 * Runs exhaustive diagnostics on a workspace and produces actionable reports.
 * Unlike validate-workspace (which checks config validity), doctor checks
 * runtime reality: tools installed, repos clean, paths resolve, commands work.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WorkspaceConfig } from '../state/workspaceState.js';
import { ComponentConfig } from '../state/schemas.js';
import { resolveWorkspaceRoot } from './resolvePath.js';
import { validateWorkspaceConfig, WorkspaceValidationResult } from './workspaceValidator.js';

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export type DoctorCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface DoctorCheck {
  status: DoctorCheckStatus;
  component: string;         // '' for workspace-level checks
  check: string;             // short name of the check
  problem: string;           // what is wrong
  whyItMatters: string;      // consequence of leaving it unfixed
  howToFix: string;          // actionable fix
}

export interface WorkspaceDoctorResult {
  workspacePath: string;
  workspaceRoot: string;
  workspaceName: string;
  profile: string | null;
  overallStatus: DoctorCheckStatus;
  checks: DoctorCheck[];
  summary: {
    passed: number;
    warnings: number;
    failures: number;
  };
}

interface ComponentToolCheck {
  name: string;
  command: string;
  versionArg: string[];
  versionRegex: RegExp;
  required: boolean;
  whyNeeded: string;
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

const REQUIRED_TOOLS: ComponentToolCheck[] = [
  {
    name: 'git',
    command: 'git',
    versionArg: ['--version'],
    versionRegex: /git version (\S+)/,
    required: true,
    whyNeeded: 'SEA uses git for evidence capture, branch tracking, and diff generation',
  },
];

const TOOL_BY_ROLE: Record<string, ComponentToolCheck[]> = {
  'source': [
    {
      name: 'node',
      command: 'node',
      versionArg: ['--version'],
      versionRegex: /v(\S+)/,
      required: false,
      whyNeeded: 'Node.js runtime for JavaScript/TypeScript projects',
    },
    {
      name: 'npm',
      command: 'npm',
      versionArg: ['--version'],
      versionRegex: /(\S+)/,
      required: false,
      whyNeeded: 'npm for installing packages and running scripts',
    },
  ],
  'application': [
    {
      name: 'node',
      command: 'node',
      versionArg: ['--version'],
      versionRegex: /v(\S+)/,
      required: false,
      whyNeeded: 'Node.js runtime for JavaScript/TypeScript projects',
    },
    {
      name: 'npm',
      command: 'npm',
      versionArg: ['--version'],
      versionRegex: /(\S+)/,
      required: false,
      whyNeeded: 'npm for installing packages and running scripts',
    },
  ],
  'service': [
    {
      name: 'java',
      command: 'java',
      versionArg: ['-version'],
      versionRegex: /version "(\S+)/,
      required: false,
      whyNeeded: 'Java runtime for Spring Boot and JVM-based services',
    },
    {
      name: 'maven',
      command: 'mvn',
      versionArg: ['--version'],
      versionRegex: /Apache Maven (\S+)/,
      required: false,
      whyNeeded: 'Maven for building Java services',
    },
  ],
  'packager': [
    {
      name: 'jar',
      command: 'jar',
      versionArg: ['--version'],
      versionRegex: /(\S+)/,
      required: false,
      whyNeeded: 'JAR tool for packaging Java artifacts',
    },
  ],
  'assembler': [
    {
      name: 'jar',
      command: 'jar',
      versionArg: ['--version'],
      versionRegex: /(\S+)/,
      required: false,
      whyNeeded: 'JAR tool for assembling WAR and EAR artifacts',
    },
  ],
};

// ---------------------------------------------------------------------------
// Doctor Runner
// ---------------------------------------------------------------------------

export async function runDoctor(workspacePath: string): Promise<WorkspaceDoctorResult> {
  const checks: DoctorCheck[] = [];
  const workspaceRoot = resolveWorkspaceRoot(workspacePath);

  // Load workspace config
  let workspaceConfig: WorkspaceConfig;
  try {
    const raw = await fs.readFile(path.resolve(workspacePath), 'utf-8');
    workspaceConfig = JSON.parse(raw);
  } catch {
    return {
      workspacePath,
      workspaceRoot,
      workspaceName: '',
      profile: null,
      overallStatus: 'FAIL',
      checks: [{
        status: 'FAIL',
        component: '',
        check: 'workspace-file',
        problem: 'Cannot read workspace.json',
        whyItMatters: 'SEA cannot operate without a valid workspace configuration',
        howToFix: `Create a valid .sea/workspace.json or run 'sea init -w <name>'`,
      }],
      summary: { passed: 0, warnings: 0, failures: 1 },
    };
  }

  const workspaceName = workspaceConfig.workspaceName || '';
  const profile = workspaceConfig.projectProfile || null;

  // Run config validation first
  const validation = await validateWorkspaceConfig(workspacePath);

  // Convert validation errors/warnings to doctor checks
  for (const err of validation.errors) {
    checks.push({
      status: 'FAIL',
      component: '',
      check: 'workspace-config',
      problem: err,
      whyItMatters: 'Invalid configuration will cause SEA to fail or behave unpredictably',
      howToFix: 'Fix the workspace.json configuration error listed above',
    });
  }
  for (const warn of validation.warnings) {
    checks.push({
      status: 'WARN',
      component: '',
      check: 'workspace-config',
      problem: warn,
      whyItMatters: 'This may cause unexpected behavior during execution',
      howToFix: 'Review and address the warning in workspace.json',
    });
  }

  // Per-component checks
  for (const comp of workspaceConfig.components || []) {
    runComponentChecks(comp, workspaceRoot, checks);
  }

  // Compute overall status
  const hasFailures = checks.some(c => c.status === 'FAIL');
  const overallStatus = hasFailures ? 'FAIL' : checks.some(c => c.status === 'WARN') ? 'WARN' : 'PASS';

  const summary = {
    passed: checks.filter(c => c.status === 'PASS').length,
    warnings: checks.filter(c => c.status === 'WARN').length,
    failures: checks.filter(c => c.status === 'FAIL').length,
  };

  return {
    workspacePath,
    workspaceRoot,
    workspaceName,
    profile,
    overallStatus,
    checks,
    summary,
  };
}

function runComponentChecks(comp: ComponentConfig, workspaceRoot: string, checks: DoctorCheck[]): void {
  const compPath = path.isAbsolute(comp.path) ? comp.path : path.resolve(workspaceRoot, comp.path);

  // 1. Git branch and dirty status
  checkGitStatus(comp.name, compPath, checks);

  // 2. Required tools
  checkTools(comp.name, compPath, comp.role || comp.kind || '', checks);

  // 3. Command existence (dry-run check)
  checkCommands(comp.name, compPath, comp, checks);

  // 4. Artifact config for assembly/packager
  checkArtifactConfig(comp.name, comp, checks);

  // 5. WAR outputGlob/outputPath
  checkWarArtifact(comp.name, comp, checks);

  // 6. Protected/forbidden paths
  checkPathPolicies(comp.name, comp, checks);
}

function checkGitStatus(compName: string, compPath: string, checks: DoctorCheck[]): void {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: compPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const statusOutput = execSync('git status --porcelain', {
      cwd: compPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const isDirty = statusOutput.trim().length > 0;

    if (isDirty) {
      checks.push({
        status: 'WARN',
        component: compName,
        check: 'git-dirty',
        problem: `Repository has uncommitted changes`,
        whyItMatters: 'Uncommitted changes may be lost if SEA reverts or resets during rollback. Evidence capture may be incomplete.',
        howToFix: `Commit or stash your changes before running SEA: cd ${compPath} && git add -A && git commit -m "WIP"`,
      });
    }

    checks.push({
      status: 'PASS',
      component: compName,
      check: 'git-branch',
      problem: '',
      whyItMatters: '',
      howToFix: '',
    });

  } catch {
    checks.push({
      status: 'FAIL',
      component: compName,
      check: 'git-status',
      problem: 'Cannot read git branch/status',
      whyItMatters: 'SEA relies on git for branch tracking and evidence capture. Without git, it cannot capture diffs or track changes.',
      howToFix: `Ensure ${compPath} is a git repository or remove it from the components list if git tracking is not needed`,
    });
  }
}

function checkTools(compName: string, compPath: string, role: string, checks: DoctorCheck[]): void {
  // Check global required tools first
  for (const tool of REQUIRED_TOOLS) {
    const available = isToolAvailable(tool.command, tool.versionArg, tool.versionRegex);
    if (!available) {
      checks.push({
        status: 'FAIL',
        component: compName,
        check: `tool-${tool.name}`,
        problem: `${tool.name} is not installed or not in PATH`,
        whyItMatters: tool.whyNeeded,
        howToFix: `Install ${tool.name} and ensure it's in your PATH, then re-run sea doctor`,
      });
    }
  }

  // Check role-specific tools
  const roleTools = TOOL_BY_ROLE[role] || [];
  for (const tool of roleTools) {
    const available = isToolAvailable(tool.command, tool.versionArg, tool.versionRegex);
    if (!available && tool.required) {
      checks.push({
        status: 'WARN',
        component: compName,
        check: `tool-${tool.name}`,
        problem: `${tool.name} is not installed (needed for ${role} components)`,
        whyItMatters: tool.whyNeeded,
        howToFix: `Install ${tool.name} to enable full verification for this component`,
      });
    }
  }
}

function isToolAvailable(cmd: string, versionArg: string[], _versionRegex: RegExp): boolean {
  try {
    execSync([cmd, ...versionArg].join(' '), { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function checkCommands(compName: string, compPath: string, comp: ComponentConfig, checks: DoctorCheck[]): void {
  if (!comp.commands || Object.keys(comp.commands).length === 0) {
    return; // No commands to check
  }

  for (const [cmdName, cmdValue] of Object.entries(comp.commands)) {
    if (typeof cmdValue !== 'string' || cmdValue.trim().length === 0) {
      checks.push({
        status: 'WARN',
        component: compName,
        check: `command-empty`,
        problem: `Command '${cmdName}' is empty or not a string`,
        whyItMatters: 'Empty commands will cause verification to fail for this component',
        howToFix: `Set a valid command string for '${cmdName}' in workspace.json for component '${compName}'`,
      });
      continue;
    }

    // Try to locate the binary being called
    const firstWord = cmdValue.trim().split(/\s+/)[0];
    const resolved = findCommand(firstWord, compPath);
    if (!resolved) {
      checks.push({
        status: 'WARN',
        component: compName,
        check: `command-not-found`,
        problem: `Command binary '${firstWord}' for '${cmdName}' not found in PATH`,
        whyItMatters: 'Verification will fail because the command cannot be executed',
        howToFix: `Ensure '${firstWord}' is installed and in PATH, or correct the command in workspace.json for component '${compName}'`,
      });
    }
  }
}

function findCommand(cmd: string, cwd: string): string | null {
  // Handle absolute paths
  if (cmd.startsWith('/') || cmd.startsWith('.')) {
    try {
      fsSync.accessSync(path.resolve(cwd, cmd));
      return cmd;
    } catch {
      return null;
    }
  }

  // Search in PATH
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(':')) {
    try {
      const fullPath = path.join(dir, cmd);
      fsSync.accessSync(fullPath);
      return fullPath;
    } catch {
      // Not found in this dir
    }
  }
  return null;
}

function checkArtifactConfig(compName: string, comp: ComponentConfig, checks: DoctorCheck[]): void {
  const artifactRoles = ['packager', 'assembler'];
  const isArtifactComponent = artifactRoles.includes(comp.role || '') || comp.kind === 'assembly';

  if (isArtifactComponent && !comp.artifact) {
    checks.push({
      status: 'FAIL',
      component: compName,
      check: 'artifact-config',
      problem: 'Assembly/packager component missing artifact configuration',
      whyItMatters: 'Without artifact config, SEA cannot verify the output or run artifact inspection',
      howToFix: `Add artifact configuration to component '${compName}' in workspace.json with type, outputPath, and requiredEntries`,
    });
    return;
  }

  if (comp.artifact && comp.artifact.type !== 'none') {
    checks.push({
      status: 'PASS',
      component: compName,
      check: 'artifact-config',
      problem: '',
      whyItMatters: '',
      howToFix: '',
    });
  }
}

function checkWarArtifact(compName: string, comp: ComponentConfig, checks: DoctorCheck[]): void {
  if (comp.artifact?.type !== 'war') return;

  const artifact = comp.artifact;
  const missing: string[] = [];

  if (!artifact.outputPath && !artifact.outputGlob) {
    missing.push('outputPath or outputGlob');
  }
  if (!artifact.requiredEntries || artifact.requiredEntries.length === 0) {
    missing.push('requiredEntries');
  }

  if (missing.length > 0) {
    checks.push({
      status: 'FAIL',
      component: compName,
      check: 'war-config',
      problem: `WAR artifact missing: ${missing.join(', ')}`,
      whyItMatters: 'WAR artifact verification will fail without these fields',
      howToFix: `Set ${missing.join(' and ')} in the artifact config for component '${compName}' in workspace.json`,
    });
  } else {
    // Check required WAR structure entries
    const required = ['WEB-INF/', 'WEB-INF/classes/', 'WEB-INF/lib/'];
    const entries = artifact.requiredEntries || [];
    for (const entry of required) {
      if (!entries.includes(entry)) {
        checks.push({
          status: 'FAIL',
          component: compName,
          check: 'war-required-entries',
          problem: `WAR missing required entry: ${entry}`,
          whyItMatters: 'WAR files must contain WEB-INF/, WEB-INF/classes/, and WEB-INF/lib/ to be valid',
          howToFix: `Add '${entry}' to requiredEntries for component '${compName}'`,
        });
      }
    }
  }
}

function checkPathPolicies(compName: string, comp: ComponentConfig, checks: DoctorCheck[]): void {
  if (!comp.protectedPaths && !comp.forbiddenPaths) {
    checks.push({
      status: 'WARN',
      component: compName,
      check: 'path-policies',
      problem: 'No protectedPaths or forbiddenPaths configured',
      whyItMatters: 'Without path policies, SEA cannot detect or prevent changes to sensitive files during evidence capture',
      howToFix: `Add protectedPaths (files that should not change) and forbiddenPaths (files that must never be modified) for component '${compName}'`,
    });
    return;
  }

  if (comp.forbiddenPaths && comp.forbiddenPaths.length > 0 && comp.protectedPaths && comp.protectedPaths.length > 0) {
    // Check for overlap
    const overlap = comp.forbiddenPaths!.filter((fp: string) =>
      (comp.protectedPaths ?? []).some((pp: string) => fp === pp || fp.startsWith(pp + '/') || pp.startsWith(fp + '/'))
    );
    if (overlap.length > 0) {
      checks.push({
        status: 'FAIL',
        component: compName,
        check: 'path-policy-conflict',
        problem: `Forbidden paths overlap with protected paths: ${overlap.join(', ')}`,
        whyItMatters: 'A file cannot be both "must not change" and "must never be modified" — this is a configuration error',
        howToFix: `Review the protectedPaths and forbiddenPaths for component '${compName}' and remove the overlap`,
      });
    }
  }

  checks.push({
    status: 'PASS',
    component: compName,
    check: 'path-policies',
    problem: '',
    whyItMatters: '',
    howToFix: '',
  });
}
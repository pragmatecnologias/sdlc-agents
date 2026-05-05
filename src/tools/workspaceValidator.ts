/**
 * Workspace Config Validator for SEA
 *
 * Validates a workspace.json configuration file and reports errors, warnings,
 * and per-component results. Used by the `sea validate-workspace` CLI command.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceConfig } from '../state/workspaceState.js';
import { resolveWorkspaceRoot } from './resolvePath.js';

export interface ComponentValidationResult {
  name: string;
  path: string;
  exists: boolean;
  isDirectory: boolean;
  isGitRepo: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkspaceValidationResult {
  workspacePath: string;
  workspaceRoot: string;
  workspaceName: string;
  profile: string | null;
  componentCount: number;
  errors: string[];
  warnings: string[];
  componentResults: ComponentValidationResult[];
  status: 'passed' | 'failed';
}

const KNOWN_PROFILES = [
  'SINGLE_REPO_FRONTEND', 'SINGLE_REPO_BACKEND', 'MONOREPO_WEB_APP',
  'MULTI_REPO_ENTERPRISE_APP', 'WAR_COMPOSITE_APP', 'SPRING_BOOT_SERVICE',
  'NODE_API', 'REACT_APP', 'ANGULAR_APP', 'VUE_APP', 'CHROME_EXTENSION',
  'THREEJS_GAME', 'PYTHON_CLI', 'LIBRARY_PACKAGE', 'MICROSERVICES_WORKSPACE',
  'INFRASTRUCTURE_REPO', 'DOCUMENTATION_REPO', 'CUSTOM',
];

/**
 * Validate a workspace configuration file.
 *
 * @param workspacePath - Absolute path to .sea/workspace.json
 * @returns Validation result with errors, warnings, and per-component details
 */
export async function validateWorkspaceConfig(
  workspacePath: string
): Promise<WorkspaceValidationResult> {
  const workspaceRoot = resolveWorkspaceRoot(workspacePath);
  const errors: string[] = [];
  const warnings: string[] = [];
  const componentResults: ComponentValidationResult[] = [];

  // Parse workspace config
  let workspaceConfig: WorkspaceConfig;
  try {
    const raw = await fs.readFile(path.resolve(workspacePath), 'utf-8');
    workspaceConfig = JSON.parse(raw);
  } catch {
    errors.push(`Cannot read workspace file: ${workspacePath}`);
    return {
      workspacePath,
      workspaceRoot,
      workspaceName: '',
      profile: null,
      componentCount: 0,
      errors,
      warnings,
      componentResults: [],
      status: 'failed',
    };
  }

  const workspaceName = workspaceConfig.workspaceName || '';
  const profile = workspaceConfig.projectProfile || null;

  // Check workspace root exists
  try {
    await fs.access(workspaceRoot);
  } catch {
    errors.push(`Workspace root does not exist: ${workspaceRoot}`);
  }

  // Validate projectProfile is recognized
  if (profile && !KNOWN_PROFILES.includes(profile)) {
    warnings.push(`Unknown project profile: ${profile}`);
  }
  if (!profile) {
    warnings.push('No projectProfile set — profile detection will be used');
  }

  // Validate components
  const components = workspaceConfig.components || [];
  if (components.length === 0) {
    errors.push('No components defined');
  }

  const componentNames = new Set<string>();

  for (const comp of components) {
    const compErrors: string[] = [];
    const compWarnings: string[] = [];
    let compExists = false;
    let compIsDir = false;
    let compIsGit = false;
    let compPath = '';

    if (!comp.name) {
      compErrors.push('Component has no name');
      componentResults.push({
        name: '(unnamed)',
        path: comp.path || '',
        exists: false,
        isDirectory: false,
        isGitRepo: false,
        errors: compErrors,
        warnings: compWarnings,
      });
      errors.push(`Component has no name`);
      continue;
    }

    if (componentNames.has(comp.name)) {
      compErrors.push(`Duplicate component name: ${comp.name}`);
      errors.push(`Duplicate component name: ${comp.name}`);
    }
    componentNames.add(comp.name);

    // Resolve and validate component path
    compPath = path.isAbsolute(comp.path) ? comp.path : path.resolve(workspaceRoot, comp.path);
    try {
      const stat = await fs.stat(compPath);
      compExists = true;
      compIsDir = stat.isDirectory();
      if (!compIsDir) {
        compErrors.push(`Component path is not a directory: ${compPath}`);
        errors.push(`[${comp.name}] Component path is not a directory: ${compPath}`);
      }
    } catch {
      compErrors.push(`Component path does not exist: ${compPath}`);
      errors.push(`[${comp.name}] Component path does not exist: ${compPath}`);
    }

    // Check if component path is a git repo
    if (compExists) {
      try {
        await fs.access(path.join(compPath, '.git'));
        compIsGit = true;
      } catch {
        compWarnings.push('Not a git repo');
      }
    }

    // Validate commands for verifiable components
    const verifyRoles = ['source', 'application', 'service', 'packager', 'assembler', 'test-suite'];
    const isVerifyTarget = verifyRoles.includes(comp.role) || verifyRoles.includes(comp.kind);
    if (isVerifyTarget && (!comp.commands || Object.keys(comp.commands).length === 0)) {
      compErrors.push('No commands configured for component that will be verified');
      errors.push(`[${comp.name}] No commands configured for component that will be verified`);
    } else if (isVerifyTarget && comp.commands) {
      const nonEmpty = Object.entries(comp.commands).filter(([, v]) => typeof v === 'string' && v.trim().length > 0);
      if (nonEmpty.length === 0) {
        compErrors.push('All commands are empty for verifiable component');
        errors.push(`[${comp.name}] All commands are empty for verifiable component`);
      }
    }

    // Validate assembly/packager components have artifact config
    const artifactRoles = ['packager', 'assembler'];
    const isArtifactComponent = artifactRoles.includes(comp.role) || comp.kind === 'assembly';
    if (isArtifactComponent && !comp.artifact) {
      compErrors.push('Assembly/packager component must have artifact config');
      errors.push(`[${comp.name}] Assembly/packager component must have artifact config`);
    }

    // Validate artifact config details
    if (comp.artifact && comp.artifact.type !== 'none') {
      if (comp.artifact.type === 'war' || comp.artifact.type === 'jar' || comp.artifact.type === 'ear') {
        if (!comp.artifact.outputPath && !comp.artifact.outputGlob) {
          compErrors.push(`${comp.artifact.type.toUpperCase()} artifact must have outputPath or outputGlob`);
          errors.push(`[${comp.name}] ${comp.artifact.type.toUpperCase()} artifact must have outputPath or outputGlob`);
        }
      }
    }

    // Warn if WAR/JAR artifacts are missing recommended requiredEntries
    if (comp.artifact && (comp.artifact.type === 'war' || comp.artifact.type === 'jar')) {
      if (!comp.artifact.requiredEntries || comp.artifact.requiredEntries.length === 0) {
        if (comp.artifact.type === 'war') {
          compWarnings.push('WAR artifact has no requiredEntries — recommend: WEB-INF/, WEB-INF/classes/, WEB-INF/lib/');
        } else {
          compWarnings.push(`${comp.artifact.type.toUpperCase()} artifact has no requiredEntries`);
        }
      }
    }

    // Validate protectedPaths and forbiddenPaths are arrays
    if (comp.protectedPaths && !Array.isArray(comp.protectedPaths)) {
      compErrors.push('protectedPaths must be an array');
      errors.push(`[${comp.name}] protectedPaths must be an array`);
    }
    if (comp.forbiddenPaths && !Array.isArray(comp.forbiddenPaths)) {
      compErrors.push('forbiddenPaths must be an array');
      errors.push(`[${comp.name}] forbiddenPaths must be an array`);
    }

    componentResults.push({
      name: comp.name,
      path: compPath,
      exists: compExists,
      isDirectory: compIsDir,
      isGitRepo: compIsGit,
      errors: compErrors,
      warnings: compWarnings,
    });
  }

  // Second pass: validate dependencies reference existing components
  for (const comp of components) {
    if (comp.dependencies && comp.dependencies.length > 0) {
      for (const dep of comp.dependencies) {
        if (!componentNames.has(dep)) {
          const compResult = componentResults.find(cr => cr.name === comp.name);
          const msg = `Dependency '${dep}' does not reference a known component`;
          if (compResult) compResult.errors.push(msg);
          errors.push(`[${comp.name}] ${msg}`);
        }
      }
    }
  }

  return {
    workspacePath,
    workspaceRoot,
    workspaceName,
    profile,
    componentCount: components.length,
    errors,
    warnings,
    componentResults,
    status: errors.length > 0 ? 'failed' : 'passed',
  };
}

/**
 * Pretty-print a validation result to the console.
 */
export function printValidationResult(result: WorkspaceValidationResult): void {
  console.log(`  Workspace file:    ${result.workspacePath}`);
  console.log(`  Workspace root:    ${result.workspaceRoot}`);
  console.log(`  Workspace name:    ${result.workspaceName || '(not set)'}`);
  console.log(`  Profile:           ${result.profile || '(not set)'}`);
  console.log(`  Components:        ${result.componentCount}`);

  for (const cr of result.componentResults) {
    const prefix = `  [${cr.name}]`;
    const gitStatus = cr.isGitRepo ? 'yes' : 'no — WARN';
    console.log(`${prefix} path: ${cr.path} (git repo: ${gitStatus})`);

    for (const w of cr.warnings) {
      console.log(`${prefix} WARN  ${w}`);
    }
    for (const e of cr.errors) {
      console.error(`${prefix} FAIL  ${e}`);
    }
  }

  // Print top-level warnings (non-component)
  for (const w of result.warnings) {
    console.log(`  WARN  ${w}`);
  }

  console.log();
  if (result.status === 'failed') {
    console.error('Validation FAILED — fix the errors above before running sea plan/run');
  } else {
    console.log('Validation PASSED — workspace is ready for use');
  }
}

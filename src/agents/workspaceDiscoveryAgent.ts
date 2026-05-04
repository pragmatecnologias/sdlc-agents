/**
 * Workspace Discovery Agent for SEA
 * Scans the workspace and discovers components
 */

import { WorkspaceState, WorkspaceDiscoveryReport, DiscoveredComponent } from '../state/workspaceState.js';
import { getGitStatus } from '../tools/gitTool.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { globby as glob } from 'globby';

const logger = createLogger('WorkspaceDiscoveryAgent');

/**
 * Create the workspace discovery agent function
 */
export function createWorkspaceDiscoveryAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running workspace discovery agent');

    const { workspace } = state;
    // The actual filesystem root is the parent of the .sea directory
    // workspace.workspaceName holds the path set by the CLI
    const workspacePath = workspace.workspaceName;

    // Validate workspace path exists
    try {
      await fs.access(workspacePath);
    } catch {
      logger.warn(`Workspace path does not exist: ${workspacePath}`);
      return {
        workspaceDiscovery: {
          workspacePath,
          isGitRepo: false,
          currentBranch: '',
          isDirty: false,
          components: [],
          buildFiles: [],
          testFolders: [],
          frameworkHints: [],
        },
      };
    }

    // Get git status
    let gitStatus;
    try {
      gitStatus = await getGitStatus(workspacePath);
    } catch {
      gitStatus = { isRepo: false, currentBranch: '', isDirty: false, staged: [], modified: [], untracked: [], deleted: [] };
    }

    // Discover components
    const discoveredComponents = await discoverComponents(workspace, workspacePath);

    // Find build files per component
    const buildFiles = await findBuildFiles(workspace, workspacePath);

    // Find test folders per component
    const testFolders = await findTestFolders(workspace, workspacePath);

    // Detect frameworks by reading file contents
    const frameworkHints = await detectFrameworks(workspace, workspacePath);

    const report: WorkspaceDiscoveryReport = {
      workspacePath,
      isGitRepo: gitStatus.isRepo,
      currentBranch: gitStatus.currentBranch,
      isDirty: gitStatus.isDirty,
      components: discoveredComponents,
      buildFiles,
      testFolders,
      frameworkHints,
    };

    logger.info(`Discovered ${discoveredComponents.length} components, ${buildFiles.length} build files, ${frameworkHints.length} framework hints`);

    return {
      workspaceDiscovery: report,
    };
  };
}

async function discoverComponents(
  workspace: WorkspaceState['workspace'],
  workspacePath: string
): Promise<DiscoveredComponent[]> {
  const components: DiscoveredComponent[] = [];

  if (workspace.components && workspace.components.length > 0) {
    // Resolve component paths relative to workspace root
    for (const config of workspace.components) {
      const componentPath = path.isAbsolute(config.path)
        ? config.path
        : path.resolve(workspacePath, config.path);

      let exists = false;
      try {
        await fs.access(componentPath);
        exists = true;
      } catch {
        logger.warn(`Component path does not exist: ${componentPath}`);
      }

      if (exists) {
        // Detect build file type
        const buildFileType = await detectBuildFileType(componentPath);

        components.push({
          name: config.name,
          path: componentPath,
          type: config.kind,
          hasBuildFile: buildFileType !== null,
          buildFileType: buildFileType || undefined,
        });
      } else {
        // Include the component even if path doesn't exist, mark as no build file
        components.push({
          name: config.name,
          path: componentPath,
          type: config.kind,
          hasBuildFile: false,
        });
      }
    }
  } else {
    // Auto-discover single component at workspace root
    const buildFileType = await detectBuildFileType(workspacePath);
    components.push({
      name: path.basename(workspacePath),
      path: workspacePath,
      type: 'unknown',
      hasBuildFile: buildFileType !== null,
      buildFileType: buildFileType || undefined,
    });
  }

  return components;
}

async function detectBuildFileType(componentPath: string): Promise<string | null> {
  const checks: [string, string][] = [
    ['package.json', 'node'],
    ['pom.xml', 'maven'],
    ['build.gradle', 'gradle'],
    ['build.gradle.kts', 'gradle-kts'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['requirements.txt', 'python'],
    ['pyproject.toml', 'python'],
    ['setup.py', 'python'],
    ['build.xml', 'ant'],
    ['Makefile', 'make'],
    ['tsconfig.json', 'typescript'],
    ['angular.json', 'angular'],
    ['.csproj', 'dotnet'],
  ];

  for (const [file, type] of checks) {
    try {
      await fs.access(path.join(componentPath, file));
      return type;
    } catch {
      // File doesn't exist at root level
    }
  }

  return null;
}

async function findBuildFiles(
  workspace: WorkspaceState['workspace'],
  workspacePath: string
): Promise<string[]> {
  const patterns = [
    'package.json',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'setup.py',
    'pyproject.toml',
    'build.xml',
    'angular.json',
    'tsconfig.json',
    'webpack.config.*',
    'rollup.config.*',
    'vite.config.*',
    'next.config.*',
  ];

  const buildFiles: string[] = [];

  if (workspace.components && workspace.components.length > 0) {
    // Search within each component directory
    for (const config of workspace.components) {
      const componentPath = path.isAbsolute(config.path)
        ? config.path
        : path.resolve(workspacePath, config.path);

      for (const pattern of patterns) {
        try {
          const matches = await glob(pattern, {
            cwd: componentPath,
            onlyFiles: true,
            deep: 2,
          });
          for (const m of matches) {
            buildFiles.push(path.join(componentPath, m));
          }
        } catch {
          // Ignore glob errors
        }
      }
    }
  } else {
    // Search at workspace root
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: workspacePath,
          onlyFiles: true,
          deep: 3,
        });
        for (const m of matches) {
          buildFiles.push(path.join(workspacePath, m));
        }
      } catch {
        // Ignore glob errors
      }
    }
  }

  return [...new Set(buildFiles)];
}

async function findTestFolders(
  workspace: WorkspaceState['workspace'],
  workspacePath: string
): Promise<string[]> {
  const patterns = [
    'test',
    'tests',
    '__tests__',
    'spec',
    'src/test',
    'src/tests',
    'src/test/java',
  ];

  const testFolders: string[] = [];

  const searchDirs = workspace.components && workspace.components.length > 0
    ? workspace.components.map(c => path.isAbsolute(c.path) ? c.path : path.resolve(workspacePath, c.path))
    : [workspacePath];

  for (const dir of searchDirs) {
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: dir,
          onlyDirectories: true,
          deep: 4,
        });
        for (const m of matches) {
          testFolders.push(path.resolve(dir, m));
        }
      } catch {
        // Ignore glob errors
      }
    }
  }

  return [...new Set(testFolders)];
}

/**
 * Detect frameworks by reading actual file contents (package.json dependencies, pom.xml, etc.)
 */
async function detectFrameworks(
  workspace: WorkspaceState['workspace'],
  workspacePath: string
): Promise<string[]> {
  const frameworks: string[] = [];
  const seen = new Set<string>();

  const searchDirs = workspace.components && workspace.components.length > 0
    ? workspace.components.map(c => path.isAbsolute(c.path) ? c.path : path.resolve(workspacePath, c.path))
    : [workspacePath];

  for (const dir of searchDirs) {
    // Check package.json dependencies
    const pkgPath = path.join(dir, 'package.json');
    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const frameworkChecks: [string, string[]][] = [
        ['react', ['react', 'react-dom', 'react-scripts', '@types/react']],
        ['vue', ['vue', '@vue/runtime-core', '@vue/compiler-sfc']],
        ['angular', ['@angular/core', '@angular/cli', 'angular']],
        ['next', ['next']],
        ['express', ['express']],
        ['fastify', ['fastify']],
        ['koa', ['koa']],
        ['vite', ['vite']],
        ['webpack', ['webpack']],
        ['three.js', ['three']],
        ['jest', ['jest']],
        ['vitest', ['vitest']],
        ['mocha', ['mocha']],
        ['typescript', ['typescript']],
      ];

      for (const [framework, deps] of frameworkChecks) {
        if (deps.some(dep => allDeps[dep]) && !seen.has(framework)) {
          frameworks.push(framework);
          seen.add(framework);
        }
      }
    } catch {
      // Not a Node.js project or can't read package.json
    }

    // Check pom.xml for Spring/Java
    const pomPath = path.join(dir, 'pom.xml');
    try {
      const content = await fs.readFile(pomPath, 'utf-8');
      if (content.includes('spring-boot') && !seen.has('spring-boot')) {
        frameworks.push('spring-boot');
        seen.add('spring-boot');
      }
      if (content.includes('<artifactId>') && !seen.has('maven')) {
        frameworks.push('maven');
        seen.add('maven');
      }
    } catch {
      // Not a Maven project
    }

    // Check build.gradle for Gradle
    for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
      try {
        const content = await fs.readFile(path.join(dir, gradleFile), 'utf-8');
        if (content.includes('spring-boot') && !seen.has('spring-boot')) {
          frameworks.push('spring-boot');
          seen.add('spring-boot');
        }
        if (!seen.has('gradle')) {
          frameworks.push('gradle');
          seen.add('gradle');
        }
      } catch {
        // Not a Gradle project
      }
    }

    // Check for Python frameworks
    for (const pyFile of ['requirements.txt', 'pyproject.toml', 'setup.py']) {
      try {
        const content = await fs.readFile(path.join(dir, pyFile), 'utf-8');
        if (content.includes('django') && !seen.has('django')) {
          frameworks.push('django');
          seen.add('django');
        }
        if (content.includes('flask') && !seen.has('flask')) {
          frameworks.push('flask');
          seen.add('flask');
        }
        if (content.includes('fastapi') && !seen.has('fastapi')) {
          frameworks.push('fastapi');
          seen.add('fastapi');
        }
      } catch {
        // Not a Python project
      }
    }
  }

  return frameworks;
}

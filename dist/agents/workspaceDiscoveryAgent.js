/**
 * Workspace Discovery Agent for SEA
 * Scans the workspace and discovers components
 */
import { getGitStatus } from '../tools/gitTool.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { globby as glob } from 'globby';
const logger = createLogger('WorkspaceDiscoveryAgent');
/**
 * Create the workspace discovery agent function
 */
export function createWorkspaceDiscoveryAgent() {
    return async (state) => {
        logger.info('Running workspace discovery agent');
        const { workspace, userRequest } = state;
        const workspacePath = workspace.workspaceName; // workspaceName is the path for single-component
        // Get git status
        const gitStatus = await getGitStatus(workspacePath);
        // Discover components
        const discoveredComponents = await discoverComponents(workspace, workspacePath);
        // Find build files
        const buildFiles = await findBuildFiles(workspacePath);
        // Find test folders
        const testFolders = await findTestFolders(workspacePath);
        // Detect framework hints
        const frameworkHints = detectFrameworks(buildFiles);
        const report = {
            workspacePath,
            isGitRepo: gitStatus.isRepo,
            currentBranch: gitStatus.currentBranch,
            isDirty: gitStatus.isDirty,
            components: discoveredComponents,
            buildFiles,
            testFolders,
            frameworkHints,
        };
        return {
            workspaceDiscovery: report,
        };
    };
}
async function discoverComponents(workspace, workspacePath) {
    const components = [];
    // If workspace has explicit components, use those
    if (workspace.components && workspace.components.length > 0) {
        for (const config of workspace.components) {
            try {
                const exists = await fs.access(config.path).then(() => true).catch(() => false);
                if (exists) {
                    components.push({
                        name: config.name,
                        path: config.path,
                        type: config.kind,
                        hasBuildFile: await hasBuildFile(config.path, config.kind),
                    });
                }
            }
            catch {
                // Component path might not exist
            }
        }
    }
    else {
        // Auto-discover single component
        const hasBuild = await hasBuildFile(workspacePath, 'unknown');
        components.push({
            name: path.basename(workspacePath),
            path: workspacePath,
            type: 'unknown',
            hasBuildFile: hasBuild,
        });
    }
    return components;
}
async function hasBuildFile(componentPath, kind) {
    const buildFilePatterns = {
        frontend: ['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts'],
        backend: ['pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml', 'requirements.txt'],
        service: ['pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml'],
        ui: ['package.json', 'tsconfig.json'],
        unknown: ['package.json', 'pom.xml', 'build.gradle', 'tsconfig.json', 'Cargo.toml', 'go.mod'],
    };
    const patterns = buildFilePatterns[kind] || buildFilePatterns.unknown;
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            cwd: componentPath,
            onlyFiles: true,
            deep: 1,
        });
        if (matches.length > 0) {
            return true;
        }
    }
    return false;
}
async function findBuildFiles(workspacePath) {
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
        'webpack.config.js',
        'rollup.config.js',
        'vite.config.ts',
        'next.config.js',
        '.csproj',
        '*.sln',
    ];
    const buildFiles = [];
    for (const pattern of patterns) {
        try {
            const matches = await glob(pattern, {
                cwd: workspacePath,
                onlyFiles: true,
                deep: 2,
            });
            buildFiles.push(...matches.map(m => path.join(workspacePath, m)));
        }
        catch {
            // Ignore errors
        }
    }
    return buildFiles;
}
async function findTestFolders(workspacePath) {
    const testPatterns = [
        '**/test',
        '**/tests',
        '**/__tests__',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/src/test',
        '**/src/tests',
        '**/test/**',
        '**/tests/**',
    ];
    const testFolders = [];
    for (const pattern of testPatterns) {
        try {
            const matches = await glob(pattern, {
                cwd: workspacePath,
                onlyDirectories: true,
                deep: 3,
            });
            testFolders.push(...matches.map(m => path.join(workspacePath, m)));
        }
        catch {
            // Ignore errors
        }
    }
    return [...new Set(testFolders)];
}
function detectFrameworks(buildFiles) {
    const frameworks = [];
    const frameworkIndicators = {
        react: [/react/i, /react-dom/i, /react-scripts/i],
        vue: [/vue/i, /@vue\//i],
        angular: [/@angular\//i, /angular/i],
        next: [/next/i],
        vite: [/vite/i],
        webpack: [/webpack/i],
        express: [/express/i],
        fastify: [/fastify/i],
        koa: [/koa/i],
        spring: [/spring/i, /spring-boot/i],
        django: [/django/i],
        flask: [/flask/i],
        fastapi: [/fastapi/i],
        three: [/three/i, /threejs/i],
    };
    for (const [framework, patterns] of Object.entries(frameworkIndicators)) {
        for (const buildFile of buildFiles) {
            const content = buildFile.toLowerCase();
            if (patterns.some(p => p.test(content))) {
                frameworks.push(framework);
                break;
            }
        }
    }
    return [...new Set(frameworks)];
}
//# sourceMappingURL=workspaceDiscoveryAgent.js.map
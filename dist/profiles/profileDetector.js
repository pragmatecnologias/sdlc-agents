/**
 * Profile Detector for SEA
 * Analyzes workspace to determine the best matching project profile
 */
import { PROFILE_DEFINITIONS, getProfileDefinition, } from './projectProfile.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { globby as glob } from 'globby';
const logger = createLogger('ProfileDetector');
/**
 * Detect the project profile for a workspace
 */
export async function detectProfile(workspacePath, components) {
    logger.info(`Detecting project profile for: ${workspacePath}`);
    // Build detection context from components
    const context = await buildDetectionContext(workspacePath, components);
    // Score each profile
    const scores = [];
    for (const [name, definition] of Object.entries(PROFILE_DEFINITIONS)) {
        const score = definition.detect(context);
        if (score > 0) {
            scores.push({ name: name, score });
        }
    }
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    if (scores.length === 0) {
        logger.info('No specific profile detected, using CUSTOM');
        return createProfile('CUSTOM', 0.5, []);
    }
    const topScore = scores[0];
    const definition = getProfileDefinition(topScore.name);
    logger.info(`Detected profile: ${topScore.name} (confidence: ${topScore.score})`);
    return createProfile(topScore.name, topScore.score, definition.requiredVerification, definition.recommendedVerification, definition.artifactStrategy, definition.notes);
}
async function buildDetectionContext(workspacePath, components) {
    const buildFiles = [];
    const componentKinds = [];
    const artifactTypes = [];
    const frameworks = [];
    let hasMonorepoStructure = false;
    // Collect from components
    for (const component of components) {
        if (component.kind) {
            componentKinds.push(component.kind);
        }
        if (component.artifact?.type && component.artifact.type !== 'none') {
            artifactTypes.push(component.artifact.type);
        }
        if (component.framework) {
            frameworks.push(component.framework.toLowerCase());
        }
        // Scan component path for build files
        try {
            const componentBuildFiles = await findBuildFiles(component.path);
            buildFiles.push(...componentBuildFiles);
        }
        catch {
            // Component path might not exist yet
        }
    }
    // Check for monorepo indicators
    hasMonorepoStructure = await checkMonorepoStructure(workspacePath);
    return {
        buildFiles,
        componentKinds: [...new Set(componentKinds)],
        artifactTypes: [...new Set(artifactTypes)],
        hasMonorepoStructure,
        frameworks: [...new Set(frameworks)],
    };
}
async function findBuildFiles(componentPath) {
    const buildFilePatterns = [
        'package.json',
        'pom.xml',
        'build.xml',
        'build.gradle',
        'build.gradle.kts',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        'setup.py',
        'pyproject.toml',
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
    try {
        for (const pattern of buildFilePatterns) {
            const matches = await glob(pattern, {
                cwd: componentPath,
                onlyFiles: true,
                deep: 1,
            });
            buildFiles.push(...matches.map(m => path.join(componentPath, m)));
        }
    }
    catch {
        // Path might not exist
    }
    return buildFiles;
}
async function checkMonorepoStructure(workspacePath) {
    const monorepoIndicators = [
        'lerna.json',
        'pnpm-workspace.yaml',
        'yarn.lock', // Could be single or multi
        'nx.json',
        'turbo.json',
        'monorepo.yaml',
        'package.json', // Check if it has workspaces
    ];
    try {
        for (const indicator of monorepoIndicators) {
            const matches = await glob(indicator, {
                cwd: workspacePath,
                onlyFiles: true,
                deep: 1,
            });
            if (matches.length > 0) {
                // Check if package.json has workspaces
                if (indicator === 'package.json') {
                    const pkgPath = path.join(workspacePath, 'package.json');
                    const content = await fs.readFile(pkgPath, 'utf-8');
                    const pkg = JSON.parse(content);
                    if (pkg.workspaces) {
                        return true;
                    }
                }
                else {
                    return true;
                }
            }
        }
    }
    catch {
        // Ignore errors
    }
    return false;
}
function createProfile(name, confidence, requiredVerification, recommendedVerification = [], artifactStrategy, notes = []) {
    return {
        name,
        confidence,
        requiredComponentRoles: [], // Would be populated by further analysis
        recommendedVerification,
        requiredVerification,
        artifactStrategy,
        notes,
    };
}
//# sourceMappingURL=profileDetector.js.map
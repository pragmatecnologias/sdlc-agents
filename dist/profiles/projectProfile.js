/**
 * Project Profile types and registry for SEA
 */
import { ProjectProfileNameSchema, ProjectProfileSchema } from '../state/schemas.js';
export { ProjectProfileNameSchema, ProjectProfileSchema };
/**
 * Predefined profile definitions
 */
export const PROFILE_DEFINITIONS = {
    SINGLE_REPO_FRONTEND: {
        name: 'SINGLE_REPO_FRONTEND',
        description: 'Single repository with a frontend application',
        detect: (ctx) => {
            const hasPackageJson = ctx.buildFiles.some(f => f.endsWith('package.json'));
            const hasFrontend = ctx.componentKinds.includes('frontend') || ctx.componentKinds.includes('ui');
            const isNotMonorepo = !ctx.hasMonorepoStructure;
            if (hasPackageJson && (hasFrontend || ctx.frameworks.length > 0) && isNotMonorepo) {
                return 0.9;
            }
            return 0;
        },
        requiredVerification: ['install', 'lint', 'test', 'build'],
        recommendedVerification: ['e2e', 'smoke'],
        notes: ['Typical: npm install, npm run lint, npm test, npm run build'],
    },
    SINGLE_REPO_BACKEND: {
        name: 'SINGLE_REPO_BACKEND',
        description: 'Single repository with a backend service',
        detect: (ctx) => {
            const hasBackend = ctx.componentKinds.includes('backend') || ctx.componentKinds.includes('service');
            const hasNoFrontend = !ctx.componentKinds.includes('ui') && !ctx.componentKinds.includes('frontend');
            if (hasBackend && hasNoFrontend && !ctx.hasMonorepoStructure) {
                return 0.8;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['lint', 'typecheck'],
        notes: ['Backend-only repository'],
    },
    MONOREPO_WEB_APP: {
        name: 'MONOREPO_WEB_APP',
        description: 'Monorepo containing multiple packages forming a web application',
        detect: (ctx) => {
            if (ctx.hasMonorepoStructure && ctx.buildFiles.some(f => f.includes('package.json'))) {
                return 0.85;
            }
            return 0;
        },
        requiredVerification: ['install', 'build', 'test'],
        recommendedVerification: ['lint', 'typecheck'],
        notes: ['Multiple packages in a single repository'],
    },
    WAR_COMPOSITE_APP: {
        name: 'WAR_COMPOSITE_APP',
        description: 'Multiple source components producing artifacts with assembly creating deployable WAR',
        detect: (ctx) => {
            const hasWarBuild = ctx.buildFiles.some(f => f.endsWith('pom.xml') || f.includes('build.xml'));
            const hasMultipleComponents = ctx.componentKinds.length >= 2;
            const hasAssembly = ctx.componentKinds.includes('assembly');
            if (hasWarBuild && hasMultipleComponents && hasAssembly) {
                return 0.95;
            }
            if (hasWarBuild && ctx.artifactTypes.includes('war')) {
                return 0.7;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['artifact-inspection'],
        artifactStrategy: 'WAR',
        notes: ['Source builds + final WAR inspection required'],
    },
    SPRING_BOOT_SERVICE: {
        name: 'SPRING_BOOT_SERVICE',
        description: 'Java Spring Boot backend service',
        detect: (ctx) => {
            const hasPomXml = ctx.buildFiles.some(f => f.endsWith('pom.xml'));
            const hasSpring = ctx.buildFiles.some(f => f.includes('application.properties') || f.includes('application.yml') ||
                f.includes('application.yaml'));
            const hasJavaSource = ctx.buildFiles.some(f => f.endsWith('.java'));
            if (hasPomXml && (hasSpring || hasJavaSource)) {
                return 0.85;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['package'],
        artifactStrategy: 'JAR',
        notes: ['mvn test, mvn package, JAR inspection'],
    },
    NODE_API: {
        name: 'NODE_API',
        description: 'Node.js API service',
        detect: (ctx) => {
            const hasPackageJson = ctx.buildFiles.some(f => f.endsWith('package.json'));
            const hasApiIndicator = ctx.frameworks.includes('express') ||
                ctx.frameworks.includes('fastify') ||
                ctx.frameworks.includes('koa');
            if (hasPackageJson && hasApiIndicator) {
                return 0.85;
            }
            return 0;
        },
        requiredVerification: ['install', 'test', 'build'],
        recommendedVerification: ['lint'],
        notes: ['Node.js REST API service'],
    },
    REACT_APP: {
        name: 'REACT_APP',
        description: 'React single-page application',
        detect: (ctx) => {
            const hasReact = ctx.frameworks.includes('react');
            if (hasReact) {
                return 0.95;
            }
            return 0;
        },
        requiredVerification: ['install', 'lint', 'test', 'build'],
        recommendedVerification: ['e2e'],
        notes: ['React SPA with npm build workflow'],
    },
    ANGULAR_APP: {
        name: 'ANGULAR_APP',
        description: 'Angular single-page application',
        detect: (ctx) => {
            const hasAngular = ctx.frameworks.includes('angular');
            const hasAngularJson = ctx.buildFiles.some(f => f.endsWith('angular.json'));
            if (hasAngular || hasAngularJson) {
                return 0.95;
            }
            return 0;
        },
        requiredVerification: ['install', 'lint', 'test', 'build'],
        recommendedVerification: ['e2e'],
        notes: ['Angular SPA with ng build workflow'],
    },
    VUE_APP: {
        name: 'VUE_APP',
        description: 'Vue.js single-page application',
        detect: (ctx) => {
            const hasVue = ctx.frameworks.includes('vue');
            if (hasVue) {
                return 0.95;
            }
            return 0;
        },
        requiredVerification: ['install', 'lint', 'test', 'build'],
        recommendedVerification: ['e2e'],
        notes: ['Vue.js SPA with npm build workflow'],
    },
    CHROME_EXTENSION: {
        name: 'CHROME_EXTENSION',
        description: 'Chrome browser extension',
        detect: (ctx) => {
            const hasManifest = ctx.buildFiles.some(f => f.endsWith('manifest.json'));
            if (hasManifest) {
                return 0.95;
            }
            return 0;
        },
        requiredVerification: ['build'],
        recommendedVerification: ['smoke'],
        artifactStrategy: 'browser-extension',
        notes: ['Chrome extension with manifest inspection'],
    },
    THREEJS_GAME: {
        name: 'THREEJS_GAME',
        description: 'Browser game built with Three.js',
        detect: (ctx) => {
            const hasThreeJs = ctx.frameworks.includes('three');
            if (hasThreeJs) {
                return 0.9;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['smoke'],
        notes: ['Three.js game - browser smoke test recommended'],
    },
    PYTHON_CLI: {
        name: 'PYTHON_CLI',
        description: 'Python command-line tool or script',
        detect: (ctx) => {
            const hasPython = ctx.buildFiles.some(f => f.endsWith('.py'));
            const hasSetupPy = ctx.buildFiles.some(f => f.endsWith('setup.py') || f.endsWith('pyproject.toml'));
            if (hasPython && hasSetupPy) {
                return 0.85;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['lint'],
        notes: ['Python package or CLI tool'],
    },
    LIBRARY_PACKAGE: {
        name: 'LIBRARY_PACKAGE',
        description: 'Library/package for distribution (npm, pip, etc.)',
        detect: (ctx) => {
            const hasPackageJson = ctx.buildFiles.some(f => f.endsWith('package.json'));
            const hasPackageBuild = ctx.buildFiles.some(f => f.includes('tsconfig') || f.includes('webpack') || f.includes('rollup'));
            if (hasPackageJson && hasPackageBuild) {
                return 0.8;
            }
            return 0;
        },
        requiredVerification: ['test', 'build', 'package'],
        recommendedVerification: ['lint', 'typecheck'],
        notes: ['npm package publishing verification'],
    },
    MICROSERVICES_WORKSPACE: {
        name: 'MICROSERVICES_WORKSPACE',
        description: 'Workspace with multiple microservices',
        detect: (ctx) => {
            const hasMultipleServices = ctx.componentKinds.filter(k => k === 'backend' || k === 'service').length >= 2;
            if (hasMultipleServices && ctx.hasMonorepoStructure) {
                return 0.8;
            }
            return 0;
        },
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['smoke'],
        notes: ['Multiple independent services'],
    },
    INFRASTRUCTURE_REPO: {
        name: 'INFRASTRUCTURE_REPO',
        description: 'Infrastructure as Code repository',
        detect: (ctx) => {
            const hasIaC = ctx.buildFiles.some(f => f.includes('terraform') || f.includes('.tf') ||
                f.includes('ansible') || f.includes('cloudformation'));
            if (hasIaC) {
                return 0.9;
            }
            return 0;
        },
        requiredVerification: ['plan'],
        recommendedVerification: ['validate'],
        notes: ['IaC with plan review'],
    },
    DOCUMENTATION_REPO: {
        name: 'DOCUMENTATION_REPO',
        description: 'Documentation repository',
        detect: (ctx) => {
            const hasDocs = ctx.componentKinds.includes('docs');
            const hasMarkdown = ctx.buildFiles.some(f => f.endsWith('.md'));
            if (hasDocs && hasMarkdown) {
                return 0.8;
            }
            return 0;
        },
        requiredVerification: ['build'],
        recommendedVerification: ['lint'],
        notes: ['Documentation with build/validation'],
    },
    MULTI_REPO_ENTERPRISE_APP: {
        name: 'MULTI_REPO_ENTERPRISE_APP',
        description: 'Multi-repository enterprise application',
        detect: () => 0.5, // Low confidence - requires external config
        requiredVerification: ['build', 'test'],
        recommendedVerification: ['integration-test'],
        notes: ['Multi-repo requires explicit configuration'],
    },
    CUSTOM: {
        name: 'CUSTOM',
        description: 'Custom project profile',
        detect: () => 0.5, // Requires explicit configuration
        requiredVerification: ['build', 'test'],
        recommendedVerification: [],
        notes: ['User-defined profile'],
    },
};
/**
 * Get all profile names
 */
export function getProfileNames() {
    return Object.keys(PROFILE_DEFINITIONS);
}
/**
 * Get profile definition
 */
export function getProfileDefinition(name) {
    return PROFILE_DEFINITIONS[name];
}
//# sourceMappingURL=projectProfile.js.map
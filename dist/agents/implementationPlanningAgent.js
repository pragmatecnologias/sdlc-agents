/**
 * Implementation Planning Agent for SEA
 * Creates component-specific implementation plans
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ImplementationPlanningAgent');
/**
 * Create the implementation planning agent function
 */
export function createImplementationPlanningAgent() {
    return async (state) => {
        logger.info('Running implementation planning agent');
        const { requirement, impactAnalysis, architecturePlan, workspace, } = state;
        if (!requirement) {
            throw new Error('Requirement report is required');
        }
        if (!impactAnalysis) {
            throw new Error('Impact analysis is required');
        }
        if (!architecturePlan) {
            throw new Error('Architecture plan is required');
        }
        // Group components into execution groups
        const executionGroups = createExecutionGroups(impactAnalysis, workspace);
        // Create component plans
        const componentPlans = createComponentPlans(impactAnalysis, requirement, architecturePlan, workspace);
        const plan = {
            executionGroups,
            componentPlans,
        };
        return { implementationPlan: plan };
    };
}
function createExecutionGroups(impactAnalysis, workspace) {
    if (!impactAnalysis)
        return [];
    const modifyComponents = impactAnalysis.affectedComponents
        .filter(c => c.changeRole === 'modify')
        .map(c => c.component);
    const verifyComponents = impactAnalysis.affectedComponents
        .filter(c => c.changeRole === 'verify_only')
        .map(c => c.component);
    // Create groups based on dependency structure
    const groups = [
        {
            groupId: 'modify',
            description: 'Components requiring code changes',
            components: modifyComponents,
            parallel: false, // Sequential for safety
            dependsOn: [],
        },
        {
            groupId: 'verify',
            description: 'Components requiring verification',
            components: verifyComponents,
            parallel: true,
            dependsOn: ['modify'],
        },
    ];
    return groups.filter(g => g.components.length > 0);
}
function createComponentPlans(impactAnalysis, requirement, architecturePlan, workspace) {
    if (!impactAnalysis)
        return [];
    const plans = [];
    for (const component of impactAnalysis.affectedComponents) {
        if (component.changeRole === 'no_change' || component.changeRole === 'blocked') {
            continue;
        }
        const componentConfig = workspace.components?.find(c => c.name === component.component);
        const plan = createComponentPlan(component, requirement, architecturePlan, componentConfig);
        plans.push(plan);
    }
    return plans;
}
function createComponentPlan(component, requirement, architecturePlan, componentConfig) {
    // Generate steps based on change role
    const steps = generateSteps(component.changeRole, requirement);
    // Get allowed paths (default to component path)
    const allowedPaths = componentConfig?.path ? [componentConfig.path] : [];
    // Get protected paths
    const protectedPaths = [
        ...(componentConfig?.protectedPaths || []),
        ...(componentConfig?.generatedPaths || []),
    ];
    // Get forbidden paths
    const forbiddenPaths = componentConfig?.forbiddenPaths || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
    ];
    // Get commands
    const commands = getComponentCommands(componentConfig);
    return {
        component: component.component,
        changeRole: component.changeRole,
        steps,
        allowedPaths,
        protectedPaths,
        forbiddenPaths,
        commands,
        definitionOfDone: generateDefinitionOfDone(component.changeRole, requirement),
        verificationExpectations: generateVerificationExpectations(component.changeRole, commands),
        requiresExecutor: component.changeRole === 'modify',
    };
}
function generateSteps(changeRole, requirement) {
    switch (changeRole) {
        case 'modify':
            return [
                `Review existing code in target area`,
                `Implement changes to satisfy: ${requirement?.title || 'unspecified requirement'}`,
                `Follow existing patterns and conventions`,
                `Add or update tests`,
                `Verify changes compile and pass tests`,
            ];
        case 'verify_only':
            return [
                `Review affected code`,
                `Run verification commands`,
                `Check for regressions`,
                `Report verification results`,
            ];
        case 'package_only':
            return [
                `Rebuild artifact`,
                `Run artifact inspection`,
                `Verify artifact contents`,
            ];
        default:
            return [];
    }
}
function getComponentCommands(componentConfig) {
    if (!componentConfig?.commands) {
        // Default commands based on common build systems
        return {
            install: 'npm install',
            lint: 'npm run lint',
            typecheck: 'npm run typecheck',
            test: 'npm test',
            build: 'npm run build',
        };
    }
    return {
        install: componentConfig.commands.install,
        lint: componentConfig.commands.lint,
        typecheck: componentConfig.commands.typecheck,
        test: componentConfig.commands.test,
        build: componentConfig.commands.build,
        package: componentConfig.commands.package,
        e2e: componentConfig.commands.e2e,
        smoke: componentConfig.commands.smoke,
        custom: componentConfig.commands.custom,
    };
}
function generateDefinitionOfDone(changeRole, requirement) {
    const dod = [
        'Code compiles without errors',
        'Existing tests pass',
    ];
    if (changeRole === 'modify') {
        dod.push('New functionality works as expected');
        if (requirement?.acceptanceCriteria) {
            dod.push(...requirement.acceptanceCriteria.slice(0, 3));
        }
    }
    if (changeRole === 'verify_only') {
        dod.push('Verification completed successfully');
        dod.push('No regressions introduced');
    }
    return dod;
}
function generateVerificationExpectations(changeRole, commands) {
    const expectations = [];
    if (changeRole === 'modify') {
        if (commands.test) {
            expectations.push(`Tests: ${commands.test}`);
        }
        if (commands.build) {
            expectations.push(`Build: ${commands.build}`);
        }
        if (commands.lint) {
            expectations.push(`Lint: ${commands.lint}`);
        }
    }
    if (changeRole === 'verify_only') {
        if (commands.test) {
            expectations.push(`Verification: ${commands.test}`);
        }
    }
    return expectations;
}
//# sourceMappingURL=implementationPlanningAgent.js.map
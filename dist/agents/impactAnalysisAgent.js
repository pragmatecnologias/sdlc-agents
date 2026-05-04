/**
 * Impact Analysis Agent for SEA
 * Classifies components for a specific request
 */
import { createLogger } from '../utils/logger.js';
const logger = createLogger('ImpactAnalysisAgent');
/**
 * Create the impact analysis agent function
 */
export function createImpactAnalysisAgent() {
    return async (state) => {
        logger.info('Running impact analysis agent');
        const { requirement, workspaceDiscovery, componentMap, userRequest } = state;
        if (!workspaceDiscovery) {
            throw new Error('Workspace discovery report is required');
        }
        const affectedComponents = [];
        const crossComponentRisks = [];
        const contractRisks = [];
        const artifactRisks = [];
        const requiresHumanReview = false;
        const humanReviewReasons = [];
        // Analyze each component
        for (const component of workspaceDiscovery.components) {
            const changeRole = analyzeComponentImpact(component, userRequest, requirement?.suspectedAffectedComponents || []);
            affectedComponents.push({
                component: component.name,
                changeRole,
                reason: getImpactReason(component, changeRole, userRequest),
            });
            // Check for risks
            if (changeRole === 'modify' || changeRole === 'unknown') {
                if (component.type === 'assembly' || component.type === 'packager') {
                    artifactRisks.push(`${component.name} is a packaging component - changes may affect artifact`);
                }
            }
        }
        // Determine execution order
        const executionOrderHints = determineExecutionOrder(affectedComponents, componentMap);
        // Check for contract risks
        if (componentMap?.artifactFlow.length) {
            contractRisks.push('Changes to artifact flow may affect dependent components');
        }
        const report = {
            affectedComponents,
            executionOrderHints,
            crossComponentRisks,
            contractRisks,
            artifactRisks,
            requiresHumanReview,
            humanReviewReasons,
        };
        return { impactAnalysis: report };
    };
}
function analyzeComponentImpact(component, request, suspectedComponents) {
    const lowerRequest = request.toLowerCase();
    const componentNameLower = component.name.toLowerCase();
    // Check if explicitly mentioned
    const isExplicitlyMentioned = suspectedComponents.some(c => c.toLowerCase() === componentNameLower);
    // Check by keywords
    const componentKeywords = {
        ui: ['ui', 'frontend', 'button', 'page', 'screen', 'component', 'interface'],
        frontend: ['frontend', 'react', 'vue', 'angular', 'page', 'component'],
        backend: ['backend', 'api', 'server', 'endpoint', 'service'],
        service: ['service', 'microservice', 'api'],
        database: ['database', 'db', 'schema', 'table', 'query', 'migration'],
        auth: ['auth', 'login', 'password', 'session', 'token', 'permission'],
        test: ['test', 'spec', 'testing', 'unit', 'integration'],
        infra: ['infra', 'infrastructure', 'deploy', 'ci', 'cd', 'pipeline'],
        docs: ['doc', 'readme', 'documentation'],
    };
    const keywords = componentKeywords[component.type] || [];
    // Check if any keyword matches
    const keywordMatch = keywords.some(k => lowerRequest.includes(k));
    if (isExplicitlyMentioned) {
        return 'modify';
    }
    if (keywordMatch) {
        return 'modify';
    }
    // Check for general development keywords that might affect multiple components
    const generalKeywords = ['refactor', 'performance', 'optimize', 'bug', 'fix'];
    const hasGeneralKeyword = generalKeywords.some(k => lowerRequest.includes(k));
    if (hasGeneralKeyword) {
        // Could affect any component - mark as verify_only
        return 'verify_only';
    }
    // Check if it's a packaging/assembly component
    if (component.type === 'assembly' || component.type === 'packager') {
        return 'verify_only';
    }
    // Default to no_change
    return 'no_change';
}
function getImpactReason(component, changeRole, request) {
    switch (changeRole) {
        case 'modify':
            return `Directly mentioned or implied by request keywords`;
        case 'verify_only':
            return `May be indirectly affected - requires verification`;
        case 'package_only':
            return `Packaging component - may need rebuild`;
        case 'artifact_verify':
            return `Artifact verification required`;
        case 'blocked':
            return `Cannot safely process this component`;
        case 'unknown':
            return `Insufficient confidence - requires human review`;
        case 'no_change':
        default:
            return `Not affected by this request`;
    }
}
function determineExecutionOrder(affectedComponents, componentMap) {
    const order = [];
    // Get modify components first
    const modifyComponents = affectedComponents
        .filter(c => c.changeRole === 'modify')
        .map(c => c.component);
    order.push(...modifyComponents);
    // Then verify_only components
    const verifyComponents = affectedComponents
        .filter(c => c.changeRole === 'verify_only')
        .map(c => c.component);
    order.push(...verifyComponents);
    // Respect component map dependency order if available
    if (componentMap?.dependencyGraph) {
        const sorted = [];
        const visited = new Set();
        const allComponents = new Set(order);
        const visit = (component) => {
            if (visited.has(component))
                return;
            visited.add(component);
            const deps = componentMap.dependencyGraph[component] || [];
            for (const dep of deps) {
                if (allComponents.has(dep)) {
                    visit(dep);
                }
            }
            sorted.push(component);
        };
        for (const comp of order) {
            visit(comp);
        }
        return sorted;
    }
    return order;
}
//# sourceMappingURL=impactAnalysisAgent.js.map
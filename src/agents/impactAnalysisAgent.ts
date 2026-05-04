/**
 * Impact Analysis Agent for SEA
 * Classifies components for a specific request
 */

import {
  WorkspaceState,
  ImpactAnalysisReport,
  AffectedComponent,
  ChangeRole,
} from '../state/workspaceState.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ImpactAnalysisAgent');

/**
 * Create the impact analysis agent function
 */
export function createImpactAnalysisAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running impact analysis agent');

    const { requirement, workspaceDiscovery, componentMap, userRequest } = state;

    if (!workspaceDiscovery) {
      throw new Error('Workspace discovery report is required');
    }

    const affectedComponents: AffectedComponent[] = [];
    const crossComponentRisks: string[] = [];
    const contractRisks: string[] = [];
    const artifactRisks: string[] = [];
    const requiresHumanReview = false;
    const humanReviewReasons: string[] = [];

    // Analyze each component
    const isSingleComponentWorkspace = workspaceDiscovery.components.length === 1;
    const isMultiComponentWorkspace = workspaceDiscovery.components.length > 2;
    for (const component of workspaceDiscovery.components) {
      const changeRole = isMultiComponentWorkspace
        ? analyzeComponentImpactMulti(component, userRequest, requirement?.suspectedAffectedComponents || [])
        : isSingleComponentWorkspace
          ? 'modify' as ChangeRole
          : analyzeComponentImpact(
              component,
              userRequest,
              requirement?.suspectedAffectedComponents || []
            );

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

    const report: ImpactAnalysisReport = {
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

function analyzeComponentImpact(
  component: { name: string; type: string },
  request: string,
  suspectedComponents: string[]
): ChangeRole {
  const lowerRequest = request.toLowerCase();
  const componentNameLower = component.name.toLowerCase();

  // Check if explicitly mentioned
  const isExplicitlyMentioned = suspectedComponents.some(
    c => c.toLowerCase() === componentNameLower
  );

  // Check by keywords
  const componentKeywords: Record<string, string[]> = {
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

/**
 * Multi-component workspace impact analysis with WAR/enterprise heuristics.
 * In a WAR composite workspace, source components (frontend/backend) are
 * always modified when the request relates to features/data, while assembly
 * components are marked verify_only for artifact verification.
 */
function analyzeComponentImpactMulti(
  component: { name: string; type: string },
  request: string,
  suspectedComponents: string[]
): ChangeRole {
  const lowerRequest = request.toLowerCase();
  const componentNameLower = component.name.toLowerCase();

  // Check if explicitly mentioned
  const isExplicitlyMentioned = suspectedComponents.some(
    c => c.toLowerCase() === componentNameLower
  );

  if (isExplicitlyMentioned) {
    return 'modify';
  }

  // Type-based heuristics for WAR composite workspaces
  switch (component.type) {
    case 'frontend':
    case 'ui': {
      // Check for UI-related keywords
      const uiKeywords = ['ui', 'frontend', 'button', 'page', 'screen', 'component', 'interface', 'login', 'form', 'search', 'display', 'view'];
      const hasUIKeyword = uiKeywords.some(k => lowerRequest.includes(k));
      if (hasUIKeyword) return 'modify';
      // Also modify if request is about data/features that likely affect UI
      const featureKeywords = ['add', 'show', 'display', 'view', 'customer', 'status', 'search', 'result', 'page'];
      const hasFeatureKeyword = featureKeywords.some(k => lowerRequest.includes(k));
      if (hasFeatureKeyword) return 'modify';
      break;
    }
    case 'backend':
    case 'service': {
      // Check for backend-related keywords
      const backendKeywords = ['backend', 'api', 'server', 'endpoint', 'service', 'database', 'auth', 'login', 'customer', 'data'];
      const hasBackendKeyword = backendKeywords.some(k => lowerRequest.includes(k));
      if (hasBackendKeyword) return 'modify';
      // Also modify for data/feature requests
      const featureKeywords = ['add', 'update', 'customer', 'status', 'search', 'result', 'data'];
      const hasFeatureKeyword = featureKeywords.some(k => lowerRequest.includes(k));
      if (hasFeatureKeyword) return 'modify';
      break;
    }
    case 'assembly':
    case 'packager': {
      // Assembly components are typically verify_only - they rebuild the artifact
      return 'verify_only';
    }
  }

  // Check for general development keywords
  const generalKeywords = ['refactor', 'performance', 'optimize', 'bug', 'fix'];
  const hasGeneralKeyword = generalKeywords.some(k => lowerRequest.includes(k));
  if (hasGeneralKeyword) return 'verify_only';

  // For WAR workspaces with multiple source components, default to modify
  // for frontend/backend types if no clear no_change signal
  if (component.type === 'frontend' || component.type === 'ui' || component.type === 'backend') {
    return 'modify';
  }

  return 'no_change';
}

function getImpactReason(
  component: { name: string; type: string },
  changeRole: ChangeRole,
  request: string
): string {
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

function determineExecutionOrder(
  affectedComponents: AffectedComponent[],
  componentMap?: WorkspaceState['componentMap']
): string[] {
  const order: string[] = [];

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
    const sorted: string[] = [];
    const visited = new Set<string>();
    const allComponents = new Set(order);

    const visit = (component: string) => {
      if (visited.has(component)) return;
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

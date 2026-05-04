/**
 * Artifact Inspection Agent for SEA
 * Inspects built artifacts for validation
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { inspectArtifact } from '../tools/artifactInspector.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ArtifactInspectionAgent');

/**
 * Create the artifact inspection agent function
 */
export function createArtifactInspectionAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running artifact inspection agent');

    const { componentStates, workspace } = state;

    const inspections = [];

    for (const [componentName, componentState] of Object.entries(componentStates || {})) {
      const component = workspace.components?.find(c => c.name === componentName);
      if (!component || !component.artifact) continue;

      // Only inspect if component was modified
      if (componentState.changeRole === 'no_change') continue;

      try {
        const report = await inspectArtifact(
          component.path,
          component.artifact.type
        );

        inspections.push(report);
      } catch (error) {
        logger.warn(`Failed to inspect artifact for ${componentName}: ${error}`);
      }
    }

    logger.info(`Inspected ${inspections.length} artifacts`);

    return { artifactInspections: inspections };
  };
}

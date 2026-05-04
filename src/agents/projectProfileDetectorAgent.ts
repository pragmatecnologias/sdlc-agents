/**
 * Project Profile Detector Agent for SEA
 * Detects project profile based on workspace structure using the profile registry
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { ProjectProfileName } from '../state/schemas.js';
import { detectProfile } from '../profiles/profileDetector.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ProjectProfileDetectorAgent');

/**
 * Create the project profile detector agent function
 */
export function createProjectProfileDetectorAgent(): (
  state: WorkspaceState
) => Promise<Partial<WorkspaceState>> {
  return async (state: WorkspaceState) => {
    logger.info('Running project profile detector agent');

    const { workspace, workspaceDiscovery } = state;

    // Check workspace config for explicit profile
    if (workspace.projectProfile) {
      logger.info(`Using explicit profile from config: ${workspace.projectProfile}`);
      const profile = await detectProfile(
        workspace.workspaceName,
        workspace.components || []
      );

      // Override the detected profile name with the configured one
      return { projectProfile: { ...profile, name: workspace.projectProfile as ProjectProfileName, confidence: 1.0 } };
    }

    // Detect from workspace structure
    const profile = await detectProfile(
      workspace.workspaceName,
      workspace.components || []
    );

    logger.info(`Detected project profile: ${profile.name} (confidence: ${profile.confidence})`);

    return { projectProfile: profile };
  };
}

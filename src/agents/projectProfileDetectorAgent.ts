/**
 * Project Profile Detector Agent for SEA
 * Detects project profile based on workspace structure
 */

import { WorkspaceState } from '../state/workspaceState.js';
import { ProjectProfile, ProjectProfileName } from '../state/schemas.js';
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

    // Detect profile based on workspace structure
    const profile = detectProjectProfile(workspace, workspaceDiscovery);

    logger.info(`Detected project profile: ${profile.name}`);

    return { projectProfile: profile };
  };
}

function detectProjectProfile(
  workspace: WorkspaceState['workspace'],
  discovery: WorkspaceState['workspaceDiscovery']
): ProjectProfile {
  let name: ProjectProfileName = 'CUSTOM';
  let confidence = 0.5;

  // Check workspace config for explicit profile
  if (workspace.projectProfile) {
    name = workspace.projectProfile as ProjectProfileName;
    confidence = 1.0;
  } else if (discovery) {
    // Java/Maven project
    if (discovery.buildFiles?.some(f => f.includes('pom.xml'))) {
      name = 'SPRING_BOOT_SERVICE';
      confidence = 0.85;
    }

    // Node.js frontend
    if (discovery.buildFiles?.some(f => f.includes('package.json'))) {
      if ((discovery.testFolders?.length ?? 0) > 0) {
        name = 'SINGLE_REPO_FRONTEND';
        confidence = 0.9;
      } else {
        name = 'SINGLE_REPO_BACKEND';
        confidence = 0.85;
      }
    }
  }

  return {
    name,
    confidence,
    requiredComponentRoles: [],
    recommendedVerification: [],
    requiredVerification: [],
    notes: [],
  };
}

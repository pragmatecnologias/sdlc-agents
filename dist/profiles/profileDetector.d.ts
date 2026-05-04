/**
 * Profile Detector for SEA
 * Analyzes workspace to determine the best matching project profile
 */
import { ProjectProfile } from './projectProfile.js';
import { ComponentConfig } from '../state/schemas.js';
/**
 * Detect the project profile for a workspace
 */
export declare function detectProfile(workspacePath: string, components: ComponentConfig[]): Promise<ProjectProfile>;
//# sourceMappingURL=profileDetector.d.ts.map
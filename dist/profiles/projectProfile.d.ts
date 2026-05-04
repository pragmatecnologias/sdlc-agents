/**
 * Project Profile types and registry for SEA
 */
import { z } from 'zod';
import { ProjectProfileNameSchema, ProjectProfileSchema } from '../state/schemas.js';
export { ProjectProfileNameSchema, ProjectProfileSchema };
export type ProjectProfileName = z.infer<typeof ProjectProfileNameSchema>;
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
/**
 * Profile definition with detection logic and verification requirements
 */
export interface ProfileDefinition {
    name: ProjectProfileName;
    description: string;
    detect: (context: DetectionContext) => number;
    requiredVerification: string[];
    recommendedVerification: string[];
    artifactStrategy?: string;
    notes: string[];
}
export interface DetectionContext {
    buildFiles: string[];
    componentKinds: string[];
    artifactTypes: string[];
    hasMonorepoStructure: boolean;
    frameworks: string[];
}
/**
 * Predefined profile definitions
 */
export declare const PROFILE_DEFINITIONS: Record<ProjectProfileName, ProfileDefinition>;
/**
 * Get all profile names
 */
export declare function getProfileNames(): ProjectProfileName[];
/**
 * Get profile definition
 */
export declare function getProfileDefinition(name: ProjectProfileName): ProfileDefinition | undefined;
//# sourceMappingURL=projectProfile.d.ts.map
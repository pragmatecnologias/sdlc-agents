/**
 * Artifact Inspector for SEA
 * Inspects JAR, WAR, npm package, static bundle artifacts
 */
import { ArtifactInspectionReport, ArtifactType } from '../state/schemas.js';
export interface ArtifactInspector {
    inspect(artifactPath: string): Promise<ArtifactInspectionReport>;
}
/**
 * Inspect a JAR artifact
 */
export declare function inspectJar(jarPath: string): Promise<ArtifactInspectionReport>;
/**
 * Inspect a WAR artifact
 */
export declare function inspectWar(warPath: string): Promise<ArtifactInspectionReport>;
/**
 * Inspect a static bundle (dist folder)
 */
export declare function inspectStaticBundle(bundlePath: string, requiredFiles?: string[]): Promise<ArtifactInspectionReport>;
/**
 * Inspect an npm package
 */
export declare function inspectNpmPackage(tarballPath: string): Promise<ArtifactInspectionReport>;
/**
 * Inspect a browser extension
 */
export declare function inspectBrowserExtension(extPath: string): Promise<ArtifactInspectionReport>;
/**
 * Inspect artifact based on type
 */
export declare function inspectArtifact(artifactPath: string, artifactType: ArtifactType): Promise<ArtifactInspectionReport>;
//# sourceMappingURL=artifactInspector.d.ts.map
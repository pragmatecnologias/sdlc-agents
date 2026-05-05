/**
 * Single artifact resolver for SEA.
 *
 * Used by:
 * - inspect-artifact CLI command
 * - artifactInspectionAgent
 *
 * Resolution order:
 * 1. If outputPath is set, resolve it relative to componentPath.
 * 2. Else if outputGlob is set, resolve via glob, pick newest file by mtime.
 * 3. Else return error.
 */

import * as path from 'path';
import { resolveArtifactPath, resolveOutputGlob, GlobMatchInfo } from './resolvePath.js';

export interface ArtifactResolution {
  /** Absolute path to the resolved artifact file */
  artifactPath: string;
  /** How the path was resolved */
  resolvedVia: 'outputPath' | 'outputGlob';
  /** Glob display info if resolved via outputGlob */
  globInfo?: GlobMatchInfo;
}

export interface ArtifactResolutionError {
  artifactPath: undefined;
  error: string;
  /** Directory that was searched */
  searchedDir?: string;
  /** Glob pattern that was tried */
  globPattern?: string;
}

export type ArtifactResolutionResult = ArtifactResolution | ArtifactResolutionError;

/**
 * Resolve a component's artifact path.
 *
 * @param componentPath - Absolute path to the component directory
 * @param outputPath - Optional explicit output path (relative to componentPath or absolute)
 * @param outputGlob - Optional glob pattern (relative to componentPath)
 * @returns Resolution result with path and metadata, or error
 */
export async function resolveComponentArtifact(
  componentPath: string,
  outputPath?: string,
  outputGlob?: string
): Promise<ArtifactResolutionResult> {
  // 1. Try explicit outputPath
  if (outputPath) {
    const resolved = resolveArtifactPath(componentPath, outputPath);
    return {
      artifactPath: resolved,
      resolvedVia: 'outputPath',
    };
  }

  // 2. Try outputGlob
  if (outputGlob) {
    const globResult = await resolveOutputGlob(componentPath, outputGlob);
    if (globResult.selectedPath) {
      return {
        artifactPath: globResult.selectedPath,
        resolvedVia: 'outputGlob',
        globInfo: globResult,
      };
    }
    return {
      artifactPath: undefined,
      error: `outputGlob failed: ${globResult.reason}`,
      searchedDir: componentPath,
      globPattern: outputGlob,
    };
  }

  // 3. Neither specified
  return {
    artifactPath: undefined,
    error: 'No outputPath or outputGlob configured for this component',
    searchedDir: componentPath,
  };
}

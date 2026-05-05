/**
 * Tests for the shared artifact resolver (resolveComponentArtifact).
 *
 * Verifies:
 * - outputPath resolution
 * - outputGlob fallback with mtime selection
 * - clear errors when neither is configured
 * - clear errors when glob matches nothing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { resolveComponentArtifact } from '../../src/tools/artifactResolver.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-artifact-resolver-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('resolveComponentArtifact', () => {
  it('resolves via outputPath when provided', async () => {
    const compDir = path.join(tmpDir, 'output-path');
    await fs.mkdir(path.join(compDir, 'target'), { recursive: true });
    await fs.writeFile(path.join(compDir, 'target', 'app.war'), 'war-content');

    const result = await resolveComponentArtifact(compDir, 'target/app.war');

    expect(result.artifactPath).toBe(path.join(compDir, 'target', 'app.war'));
    expect(result.resolvedVia).toBe('outputPath');
  });

  it('resolves absolute outputPath directly', async () => {
    const compDir = path.join(tmpDir, 'abs-output');
    await fs.mkdir(compDir, { recursive: true });
    const absPath = path.join(compDir, 'build.jar');
    await fs.writeFile(absPath, 'jar-content');

    const result = await resolveComponentArtifact(compDir, absPath);

    expect(result.artifactPath).toBe(absPath);
    expect(result.resolvedVia).toBe('outputPath');
  });

  it('falls back to outputGlob when outputPath is not set', async () => {
    const compDir = path.join(tmpDir, 'glob-fallback');
    await fs.mkdir(path.join(compDir, 'build', 'libs'), { recursive: true });
    await fs.writeFile(path.join(compDir, 'build', 'libs', 'app.jar'), 'jar-content');

    const result = await resolveComponentArtifact(compDir, undefined, 'build/libs/*.jar');

    expect(result.artifactPath).toBe(path.join(compDir, 'build', 'libs', 'app.jar'));
    expect(result.resolvedVia).toBe('outputGlob');
    if (result.resolvedVia === 'outputGlob') {
      expect(result.globInfo).toBeDefined();
      expect(result.globInfo!.allMatches).toHaveLength(1);
    }
  });

  it('selects newest file from outputGlob matches', async () => {
    const compDir = path.join(tmpDir, 'glob-newest');
    await fs.mkdir(path.join(compDir, 'output'), { recursive: true });

    const olderFile = path.join(compDir, 'output', 'app-1.0.war');
    const newerFile = path.join(compDir, 'output', 'app-2.0.war');
    await fs.writeFile(olderFile, 'old');
    await fs.writeFile(newerFile, 'new');

    const oldTime = new Date(Date.now() - 3600000);
    await fs.utimes(olderFile, oldTime, oldTime);

    const result = await resolveComponentArtifact(compDir, undefined, 'output/*.war');

    expect(result.artifactPath).toBe(newerFile);
    expect(result.resolvedVia).toBe('outputGlob');
  });

  it('returns error when neither outputPath nor outputGlob is set', async () => {
    const compDir = path.join(tmpDir, 'no-config');
    await fs.mkdir(compDir, { recursive: true });

    const result = await resolveComponentArtifact(compDir);

    expect(result.artifactPath).toBeUndefined();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('No outputPath or outputGlob');
    }
  });

  it('returns error when outputGlob matches nothing', async () => {
    const compDir = path.join(tmpDir, 'glob-empty');
    await fs.mkdir(path.join(compDir, 'target'), { recursive: true });
    await fs.writeFile(path.join(compDir, 'target', 'app.jar'), 'not-a-war');

    const result = await resolveComponentArtifact(compDir, undefined, 'target/*.war');

    expect(result.artifactPath).toBeUndefined();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('outputGlob failed');
    }
  });

  it('ignores directories when matching outputGlob', async () => {
    const compDir = path.join(tmpDir, 'glob-ignore-dirs');
    await fs.mkdir(path.join(compDir, 'output'), { recursive: true });
    // Create a directory that matches the glob pattern name
    await fs.mkdir(path.join(compDir, 'output', 'app.war'), { recursive: true });
    // Create a real file that also matches
    await fs.writeFile(path.join(compDir, 'output', 'real.war'), 'war-content');

    const result = await resolveComponentArtifact(compDir, undefined, 'output/*.war');

    expect(result.artifactPath).toBe(path.join(compDir, 'output', 'real.war'));
    expect(result.resolvedVia).toBe('outputGlob');
    if (result.resolvedVia === 'outputGlob') {
      // Should only match the file, not the directory
      expect(result.globInfo!.allMatches).toHaveLength(1);
      expect(result.globInfo!.allMatches[0]).toContain('real.war');
    }
  });
});

/**
 * Tests for outputGlob resolution with mtime-based newest-file selection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { resolveOutputGlob } from '../../src/tools/resolvePath.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sea-glob-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('resolveOutputGlob', () => {
  it('selects a single matching file', async () => {
    const compDir = path.join(tmpDir, 'single-match');
    const outputDir = path.join(compDir, 'target');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'app.war'), 'fake-war-content');

    const result = await resolveOutputGlob(compDir, 'target/*.war');

    expect(result.selectedPath).toBe(path.join(outputDir, 'app.war'));
    expect(result.allMatches).toHaveLength(1);
    expect(result.reason).toContain('Single match');
  });

  it('selects newest file when multiple match', async () => {
    const compDir = path.join(tmpDir, 'multi-match');
    const outputDir = path.join(compDir, 'build');
    await fs.mkdir(outputDir, { recursive: true });

    // Create two files with different mtimes
    const olderFile = path.join(outputDir, 'app-1.0.war');
    const newerFile = path.join(outputDir, 'app-2.0.war');
    await fs.writeFile(olderFile, 'old-war');
    await fs.writeFile(newerFile, 'new-war');

    // Set older file mtime to 1 hour ago
    const oldTime = new Date(Date.now() - 3600000);
    await fs.utimes(olderFile, oldTime, oldTime);

    // newerFile already has current mtime (just created)

    const result = await resolveOutputGlob(compDir, 'build/*.war');

    expect(result.selectedPath).toBe(newerFile);
    expect(result.allMatches).toHaveLength(2);
    expect(result.reason).toContain('newest of 2');
    expect(result.reason).toContain('app-2.0.war');
  });

  it('fails clearly when no files match', async () => {
    const compDir = path.join(tmpDir, 'no-match');
    const outputDir = path.join(compDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'app.jar'), 'not-a-war');

    const result = await resolveOutputGlob(compDir, 'output/*.war');

    expect(result.selectedPath).toBeNull();
    expect(result.allMatches).toHaveLength(0);
    expect(result.reason).toContain('No files matching');
    expect(result.reason).toContain('output/*.war');
  });

  it('fails clearly when directory does not exist', async () => {
    const compDir = path.join(tmpDir, 'missing-dir');

    const result = await resolveOutputGlob(compDir, 'nonexistent/*.war');

    expect(result.selectedPath).toBeNull();
    expect(result.reason).toContain('does not exist');
  });

  it('ignores directories matching the glob pattern', async () => {
    const compDir = path.join(tmpDir, 'dirs-and-files');
    const outputDir = path.join(compDir, 'target');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'subdir')); // directory that matches *.war won't exist but let's make a .war dir
    await fs.mkdir(path.join(outputDir, 'app.war')); // a directory named app.war
    await fs.writeFile(path.join(outputDir, 'real.war'), 'real-content');

    const result = await resolveOutputGlob(compDir, 'target/*.war');

    // Should only match real.war (file), not app.war (directory)
    expect(result.selectedPath).toBe(path.join(outputDir, 'real.war'));
    expect(result.allMatches).toHaveLength(1);
  });

  it('supports ? single-char glob pattern', async () => {
    const compDir = path.join(tmpDir, 'single-char');
    const outputDir = path.join(compDir, 'out');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'build1.zip'), 'zip1');
    await fs.writeFile(path.join(outputDir, 'build2.zip'), 'zip2');
    await fs.writeFile(path.join(outputDir, 'build10.zip'), 'zip10');

    const result = await resolveOutputGlob(compDir, 'out/build?.zip');

    // ? matches exactly one char, so build1.zip and build2.zip match, build10.zip does not
    expect(result.allMatches).toHaveLength(2);
    expect(result.selectedPath).not.toBeNull();
  });
});

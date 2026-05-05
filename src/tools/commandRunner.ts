/**
 * Command Runner Tool for SEA
 * Executes shell commands and captures output
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
import { CommandResult, CommandStatus } from '../state/schemas.js';

const logger = createLogger('CommandRunner');

export interface CommandOptions {
  cwd?: string;
  timeout?: number; // in milliseconds
  env?: Record<string, string>;
  shell?: boolean;
  continueOnError?: (result: CommandResult) => boolean;
  autoSave?: boolean; // automatically save stdout/stderr to files
  saveDir?: string; // directory to save output files when autoSave is true
  commandName?: string; // logical name (e.g. "test", "build") — overrides auto-derived name
}

/**
 * Run a shell command
 */
export async function runCommand(
  command: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const component = options.cwd || 'unknown';
  const commandName = options.commandName || path.basename(command.split(' ')[0]);

  return new Promise<CommandResult>((resolve) => {
    const {
      cwd = process.cwd(),
      timeout = 120000, // 2 minute default
      env = process.env as Record<string, string>,
      shell = true,
      autoSave = false,
      saveDir,
    } = options;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;

    const proc: ChildProcess = spawn(command, [], {
      cwd,
      env,
      shell,
      // Do NOT pass timeout to spawn -- we handle it ourselves with setTimeout
    });

    // Single timeout mechanism using setTimeout only
    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      proc.kill('SIGTERM');

      // Force kill after grace period if SIGTERM didn't work
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process already exited
        }
      }, 5000);
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      let status: CommandStatus;
      if (timedOut) {
        status = 'failed';
        stderr += '\n[TIMEOUT] Command exceeded timeout limit';
      } else if (code === 0) {
        status = 'passed';
      } else {
        status = 'failed';
      }

      let stdoutPath = '';
      let stderrPath = '';

      const exitCode = timedOut ? -1 : (code ?? 0);

      const result: CommandResult = {
        component,
        commandName,
        command,
        exitCode,
        status,
        stdout,
        stderr,
        stdoutPath,
        stderrPath,
        durationMs,
        startedAt,
        finishedAt,
      };

      if (autoSave) {
        const outputDir = saveDir || cwd;
        saveCommandOutput(result, outputDir).then((paths) => {
          result.stdoutPath = paths.stdoutPath;
          result.stderrPath = paths.stderrPath;
          resolve(result);
        }).catch((err) => {
          logger.error(`Failed to auto-save command output for: ${command}`, err);
          // Resolve with empty paths rather than failing
          resolve(result);
        });
      } else {
        resolve(result);
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      stderr += `\n[ERROR] ${error.message}`;

      const result: CommandResult = {
        component,
        commandName,
        command,
        exitCode: -1,
        status: 'failed',
        stdout,
        stderr,
        stdoutPath: '',
        stderrPath: '',
        durationMs,
        startedAt,
        finishedAt,
      };

      logger.error(`Command failed: ${command}`, error);

      if (autoSave) {
        const outputDir = saveDir || cwd;
        saveCommandOutput(result, outputDir).then((paths) => {
          result.stdoutPath = paths.stdoutPath;
          result.stderrPath = paths.stderrPath;
          resolve(result);
        }).catch((err) => {
          logger.error(`Failed to auto-save error output for: ${command}`, err);
          resolve(result);
        });
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Run multiple commands in sequence
 */
export async function runCommands(
  commands: string[],
  options: CommandOptions = {}
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const command of commands) {
    logger.info(`Running: ${command}`);
    const result = await runCommand(command, options);
    results.push(result);

    // Stop on first failure unless commanded to continue
    if (result.status === 'failed' && !options.continueOnError?.(result)) {
      break;
    }
  }

  return results;
}

/**
 * Save command output to files and return paths.
 * Uses stdout and stderr directly from the CommandResult.
 */
export async function saveCommandOutput(
  result: CommandResult,
  outputDir: string
): Promise<{ stdoutPath: string; stderrPath: string }> {
  await fs.mkdir(outputDir, { recursive: true });

  const stdoutPath = path.join(outputDir, `${result.commandName}-stdout.txt`);
  const stderrPath = path.join(outputDir, `${result.commandName}-stderr.txt`);

  const stdoutContent = result.stdout ?? '';
  const stderrContent = result.stderr ?? '';

  await fs.writeFile(stdoutPath, stdoutContent, 'utf-8');
  await fs.writeFile(stderrPath, stderrContent, 'utf-8');

  logger.debug(`Saved stdout to ${stdoutPath} (${stdoutContent.length} chars)`);
  logger.debug(`Saved stderr to ${stderrPath} (${stderrContent.length} chars)`);

  return { stdoutPath, stderrPath };
}

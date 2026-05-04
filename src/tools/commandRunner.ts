/**
 * Command Runner Tool for SEA
 * Executes shell commands and captures output
 */

import { spawn } from 'child_process';
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
}

/**
 * Run a shell command
 */
export async function runCommand(
  command: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  const startedAt = new Date().toISOString();
  const component = options.cwd || 'unknown';
  const commandName = path.basename(command.split(' ')[0]);

  return new Promise<CommandResult>((resolve) => {
    const {
      cwd = process.cwd(),
      timeout = 120000, // 2 minute default
      env = process.env,
      shell = true,
    } = options;

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(command, [], {
      cwd,
      env,
      shell,
      timeout,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
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

      let status: CommandStatus;
      if (timedOut) {
        status = 'failed';
        stderr += '\n[TIMEOUT] Command exceeded timeout limit';
      } else if (code === 0) {
        status = 'passed';
      } else {
        status = 'failed';
      }

      resolve({
        component,
        commandName,
        command,
        exitCode: code ?? (timedOut ? -1 : 0),
        status,
        stdoutPath: '', // Would be set by caller
        stderrPath: '',
        durationMs: 0, // Would calculate from timestamps
        startedAt,
        finishedAt,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();

      resolve({
        component,
        commandName,
        command,
        exitCode: -1,
        status: 'failed',
        stdoutPath: '',
        stderrPath: '',
        durationMs: 0,
        startedAt,
        finishedAt,
      });

      logger.error(`Command failed: ${command}`, error);
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

export interface ContinueOnErrorFn {
  (result: CommandResult): boolean;
}

export interface RunCommandsOptions extends CommandOptions {
  continueOnError?: ContinueOnErrorFn;
}

/**
 * Save command output to files and return paths
 */
export async function saveCommandOutput(
  result: CommandResult,
  outputDir: string
): Promise<{ stdoutPath: string; stderrPath: string }> {
  await fs.mkdir(outputDir, { recursive: true });

  const stdoutPath = result.stdoutPath || path.join(outputDir, `${result.commandName}-stdout.txt`);
  const stderrPath = result.stderrPath || path.join(outputDir, `${result.commandName}-stderr.txt`);

  // If result has inline stdout/stderr (not paths), save to files
  if (result.stdoutPath === '' || result.stdoutPath === undefined) {
    await fs.writeFile(stdoutPath, (result as any).stdout || '', 'utf-8');
    await fs.writeFile(stderrPath, (result as any).stderr || '', 'utf-8');
  }

  return { stdoutPath, stderrPath };
}

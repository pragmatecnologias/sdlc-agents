/**
 * Command Runner Tool for SEA
 * Executes shell commands and captures output
 */
import { CommandResult } from '../state/schemas.js';
export interface CommandOptions {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
    shell?: boolean;
    continueOnError?: (result: CommandResult) => boolean;
}
/**
 * Run a shell command
 */
export declare function runCommand(command: string, options?: CommandOptions): Promise<CommandResult>;
/**
 * Run multiple commands in sequence
 */
export declare function runCommands(commands: string[], options?: CommandOptions): Promise<CommandResult[]>;
export interface ContinueOnErrorFn {
    (result: CommandResult): boolean;
}
export interface RunCommandsOptions extends CommandOptions {
    continueOnError?: ContinueOnErrorFn;
}
/**
 * Save command output to files and return paths
 */
export declare function saveCommandOutput(result: CommandResult, outputDir: string): Promise<{
    stdoutPath: string;
    stderrPath: string;
}>;
//# sourceMappingURL=commandRunner.d.ts.map
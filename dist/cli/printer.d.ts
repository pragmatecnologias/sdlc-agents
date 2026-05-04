/**
 * Output formatting utilities for SEA CLI
 */
import { WorkspaceState } from '../state/workspaceState.js';
/**
 * Print a formatted header
 */
export declare function printHeader(title: string): void;
/**
 * Print a section
 */
export declare function printSection(title: string, content: string | string[]): void;
/**
 * Print a key-value pair
 */
export declare function printKeyValue(key: string, value: string): void;
/**
 * Print final report
 */
export declare function printFinalReport(state: WorkspaceState): void;
/**
 * Print error message
 */
export declare function printError(message: string, error?: unknown): void;
/**
 * Print success message
 */
export declare function printSuccess(message: string): void;
/**
 * Print info message
 */
export declare function printInfo(message: string): void;
//# sourceMappingURL=printer.d.ts.map
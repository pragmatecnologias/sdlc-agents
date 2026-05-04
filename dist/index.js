#!/usr/bin/env node
/**
 * SEA - Software Engineering Agents
 * Main entry point
 */
import { Command } from 'commander';
import { registerCommands } from './cli/commands.js';
async function main() {
    const program = new Command();
    // Register all CLI commands
    registerCommands(program);
    // Parse and execute
    await program.parseAsync(process.argv);
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
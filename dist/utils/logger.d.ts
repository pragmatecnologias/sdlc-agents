/**
 * Simple logger for SEA
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class Logger {
    private context;
    private minLevel;
    constructor(context: string, minLevel?: LogLevel);
    private shouldLog;
    private format;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    /**
     * Create a child logger with a new context
     */
    child(context: string): Logger;
    /**
     * Set the minimum log level
     */
    setLevel(level: LogLevel): void;
}
export declare function createLogger(context: string): Logger;
export declare const defaultLogger: Logger;
export { Logger };
//# sourceMappingURL=logger.d.ts.map
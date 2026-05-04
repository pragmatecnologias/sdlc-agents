/**
 * Simple logger for SEA
 */
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class Logger {
    context;
    minLevel;
    constructor(context, minLevel = 'info') {
        this.context = context;
        this.minLevel = minLevel;
    }
    shouldLog(level) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
    }
    format(level, message, data) {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        const contextStr = `[${this.context}]`.padEnd(20);
        let formatted = `${timestamp} ${levelStr} ${contextStr} ${message}`;
        if (data !== undefined) {
            if (typeof data === 'object') {
                formatted += `\n${JSON.stringify(data, null, 2)}`;
            }
            else {
                formatted += ` ${data}`;
            }
        }
        return formatted;
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.log(this.format('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.log(this.format('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', message, data));
        }
    }
    error(message, data) {
        if (this.shouldLog('error')) {
            console.error(this.format('error', message, data));
        }
    }
    /**
     * Create a child logger with a new context
     */
    child(context) {
        return new Logger(`${this.context}:${context}`, this.minLevel);
    }
    /**
     * Set the minimum log level
     */
    setLevel(level) {
        this.minLevel = level;
    }
}
export function createLogger(context) {
    return new Logger(context);
}
// Default logger instance
export const defaultLogger = createLogger('sea');
export { Logger };
//# sourceMappingURL=logger.js.map
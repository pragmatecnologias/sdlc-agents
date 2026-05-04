/**
 * Simple logger for SEA
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = `[${this.context}]`.padEnd(20);
    let formatted = `${timestamp} ${levelStr} ${contextStr} ${message}`;
    if (data !== undefined) {
      if (typeof data === 'object') {
        formatted += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        formatted += ` ${data}`;
      }
    }
    return formatted;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, data));
    }
  }

  /**
   * Create a child logger with a new context
   */
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.minLevel);
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Default logger instance
export const defaultLogger = createLogger('sea');

export { Logger };

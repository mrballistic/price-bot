/**
 * @fileoverview Simple logging utility for the price-bot application.
 *
 * Provides a minimal logging interface with configurable log levels.
 * Log level can be controlled via the LOG_LEVEL environment variable.
 * Outputs timestamped messages to stdout in a consistent format.
 *
 * @module core/logger
 */

/**
 * Valid log level identifiers.
 * Levels are ordered from most verbose (debug) to least verbose (error).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

/**
 * Numeric priority for each log level.
 * Higher numbers are more severe/important.
 */
const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Current log level from environment, defaults to 'info'. */
const LOG_LEVEL = (process.env.LOG_LEVEL as Level) || 'info';

/** Minimum numeric level required for a message to be logged. */
const minLevel = levelOrder[LOG_LEVEL] ?? levelOrder.info;

/**
 * Internal logging function that handles level filtering and output formatting.
 *
 * @param level - The log level for this message
 * @param msg - The message to log
 * @param meta - Optional metadata to append to the log line
 * @private
 */
function log(level: Level, msg: string, meta?: unknown): void {
  if (levelOrder[level] < minLevel) return;
  const ts = new Date().toISOString();
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] ${level.toUpperCase()} ${msg}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[${ts}] ${level.toUpperCase()} ${msg}`);
  }
}

/**
 * Logger instance with methods for each log level.
 *
 * Messages are filtered based on the LOG_LEVEL environment variable.
 * Each method accepts a message string and optional metadata object.
 *
 * @example
 * ```typescript
 * import { logger } from './core/logger';
 *
 * logger.debug('Processing item', { id: 123 });
 * logger.info('Run completed successfully');
 * logger.warn('Rate limit approaching');
 * logger.error('Failed to fetch listings', error);
 * ```
 */
export const logger = {
  /** Log a debug message. Only shown when LOG_LEVEL=debug. */
  debug: (m: string, meta?: unknown) => log('debug', m, meta),

  /** Log an info message. Shown when LOG_LEVEL is debug or info. */
  info: (m: string, meta?: unknown) => log('info', m, meta),

  /** Log a warning message. Shown when LOG_LEVEL is debug, info, or warn. */
  warn: (m: string, meta?: unknown) => log('warn', m, meta),

  /** Log an error message. Always shown regardless of LOG_LEVEL. */
  error: (m: string, meta?: unknown) => log('error', m, meta),
};

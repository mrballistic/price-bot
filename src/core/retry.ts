/**
 * @fileoverview Retry utility with exponential backoff for handling transient failures.
 *
 * Provides a generic retry wrapper that automatically retries failed operations
 * with exponential backoff delays. Useful for API calls that may fail due to
 * rate limits, network issues, or temporary service unavailability.
 *
 * @module core/retry
 */

import { logger } from './logger';

/**
 * Options for configuring retry behavior.
 */
interface RetryOptions {
  /** Maximum number of retry attempts (not including initial attempt) */
  retries: number;
  /** Base delay in milliseconds (doubles with each retry) */
  baseDelayMs: number;
  /** Descriptive label for logging (e.g., "ebay.search") */
  label: string;
}

/**
 * Executes an async function with automatic retry and exponential backoff.
 *
 * If the function throws an error, it will be retried up to `opts.retries` times.
 * The delay between retries follows an exponential backoff pattern:
 * - 1st retry: baseDelayMs
 * - 2nd retry: baseDelayMs * 2
 * - 3rd retry: baseDelayMs * 4
 * - etc.
 *
 * Failed attempts are logged as warnings. If all attempts fail, the last
 * error is thrown.
 *
 * @template T - The return type of the function being retried
 * @param fn - The async function to execute
 * @param opts - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * import { retry } from './core/retry';
 *
 * const data = await retry(
 *   () => fetchFromApi(url),
 *   {
 *     retries: 3,
 *     baseDelayMs: 500,
 *     label: 'api.fetch'
 *   }
 * );
 * ```
 *
 * @example
 * // With arrow function for inline API call
 * const listings = await retry(
 *   async () => {
 *     const resp = await fetch(endpoint);
 *     if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
 *     return resp.json();
 *   },
 *   { retries: 3, baseDelayMs: 1000, label: 'marketplace.search' }
 * );
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= opts.retries) break;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      logger.warn(
        `${opts.label} failed (attempt ${attempt + 1}/${opts.retries + 1}); retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

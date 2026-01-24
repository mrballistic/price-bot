/**
 * @fileoverview Sleep utility for introducing delays in async operations.
 *
 * Provides a promise-based sleep function useful for rate limiting,
 * retry delays, and other scenarios requiring timed pauses.
 *
 * @module core/sleep
 */

/**
 * Pauses execution for a specified number of milliseconds.
 *
 * Returns a promise that resolves after the specified delay,
 * allowing use with async/await syntax for clean delay handling.
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * import { sleep } from './core/sleep';
 *
 * async function rateLimitedFetch() {
 *   const result = await fetch(url);
 *   await sleep(1000); // Wait 1 second before next request
 *   return result;
 * }
 * ```
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

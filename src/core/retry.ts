
import { logger } from './logger';

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; label: string },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= opts.retries) break;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      logger.warn(`${opts.label} failed (attempt ${attempt + 1}/${opts.retries + 1}); retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

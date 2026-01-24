import { describe, it, expect } from 'vitest';
import { sleep } from './sleep';

describe('sleep', () => {
  it('should delay for approximately the specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;

    // Allow some tolerance for timing
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });

  it('should resolve without a value', async () => {
    const result = await sleep(10);
    expect(result).toBeUndefined();
  });
});

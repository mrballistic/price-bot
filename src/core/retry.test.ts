import { describe, it, expect, vi } from 'vitest';
import { retry } from './retry';

// Mock the logger to avoid console output during tests
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('retry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn, {
      retries: 3,
      baseDelayMs: 10,
      label: 'test',
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retry(fn, {
      retries: 3,
      baseDelayMs: 10,
      label: 'test',
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      retry(fn, {
        retries: 2,
        baseDelayMs: 10,
        label: 'test',
      }),
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

    const start = Date.now();
    await retry(fn, {
      retries: 3,
      baseDelayMs: 50,
      label: 'test',
    });
    const elapsed = Date.now() - start;

    // First retry should wait ~50ms (baseDelayMs * 2^0)
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(150);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  const originalEnv = process.env.LOG_LEVEL;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.LOG_LEVEL = originalEnv;
    vi.resetModules();
  });

  it('should log info messages by default', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    logger.info('test info message');

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('INFO');
    expect(call).toContain('test info message');
  });

  it('should log warn messages by default', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    logger.warn('test warning');

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('WARN');
    expect(call).toContain('test warning');
  });

  it('should log error messages by default', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    logger.error('test error');

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('ERROR');
    expect(call).toContain('test error');
  });

  it('should not log debug messages by default', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    logger.debug('test debug');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log debug messages when LOG_LEVEL=debug', async () => {
    process.env.LOG_LEVEL = 'debug';
    const { logger } = await import('./logger');

    logger.debug('test debug message');

    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('DEBUG');
    expect(call).toContain('test debug message');
  });

  it('should include timestamp in log output', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    logger.info('timestamp test');

    const call = consoleSpy.mock.calls[0][0];
    // ISO timestamp pattern
    expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  it('should include metadata when provided', async () => {
    delete process.env.LOG_LEVEL;
    const { logger } = await import('./logger');

    const meta = { key: 'value', num: 42 };
    logger.info('with meta', meta);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('with meta'), meta);
  });

  it('should only log error when LOG_LEVEL=error', async () => {
    process.env.LOG_LEVEL = 'error';
    const { logger } = await import('./logger');

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');

    expect(consoleSpy).not.toHaveBeenCalled();

    logger.error('error');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('ERROR');
  });

  it('should log warn and above when LOG_LEVEL=warn', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { logger } = await import('./logger');

    logger.debug('debug');
    logger.info('info');

    expect(consoleSpy).not.toHaveBeenCalled();

    logger.warn('warn');
    logger.error('error');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });
});

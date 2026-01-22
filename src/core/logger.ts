type Level = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_LEVEL = (process.env.LOG_LEVEL as Level) || 'info';
const minLevel = levelOrder[LOG_LEVEL] ?? levelOrder.info;

function log(level: Level, msg: string, meta?: unknown) {
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

export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};

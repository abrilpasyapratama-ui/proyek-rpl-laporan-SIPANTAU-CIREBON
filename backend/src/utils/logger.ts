/* Structured (JSON) logger with levels. Hook point for external services
   (e.g. Sentry/Datadog) can be added inside `write`. */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel: Level =
  (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(meta || {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
  audit: (action: string, meta?: Record<string, unknown>) =>
    write('info', `AUDIT: ${action}`, { audit: true, ...meta }),
};

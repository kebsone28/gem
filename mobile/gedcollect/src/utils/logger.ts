const LOG_PREFIX = '[GedCollect]';

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`${LOG_PREFIX} ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${LOG_PREFIX} ⚠ ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`${LOG_PREFIX} ✗ ${message}`, ...args);
  },
};

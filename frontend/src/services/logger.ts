 
/**
 * Structured Logger Service
 * Centralises all application logging with categories and levels.
 * In production: only errors are emitted.
 * In development: full output with emoji prefixes.
 */

const isProd = import.meta.env?.PROD ?? false;

export type LogCategory =
  | 'SYNC'
  | 'OFFLINE'
  | 'AUTH'
  | 'CONFLICT'
  | 'QUEUE'
  | 'RETRY'
  | 'UI'
  | 'PERF'
  | 'GENERAL';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: unknown;
  timestamp: string;
}

const categoryEmoji: Record<LogCategory, string> = {
  SYNC: '🔄',
  OFFLINE: '📡',
  AUTH: '🔐',
  CONFLICT: '⚔️',
  QUEUE: '📋',
  RETRY: '🔁',
  UI: '🖼️',
  PERF: '⚡',
  GENERAL: '📝',
};

const levelEmoji: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

function formatMessage(level: LogLevel, category: LogCategory, message: string): string {
  return `${levelEmoji[level]} ${categoryEmoji[category]} [${category}] ${message}`;
}

function createEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: unknown
): LogEntry {
  return {
    level,
    category,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

// In-memory ring buffer for the last 100 entries (useful for diagnostics)
const _logBuffer: LogEntry[] = [];
const LOG_BUFFER_SIZE = 100;

function pushToBuffer(entry: LogEntry) {
  _logBuffer.push(entry);
  if (_logBuffer.length > LOG_BUFFER_SIZE) {
    _logBuffer.shift();
  }
}

function emit(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
  const entry = createEntry(level, category, message, data);
  pushToBuffer(entry);

  if (isProd && level !== 'error') return;

  const formatted = formatMessage(level, category, message);

  switch (level) {
    case 'debug':
      console.debug(formatted, ...(data !== undefined ? [data] : []));
      break;
    case 'info':
      console.log(formatted, ...(data !== undefined ? [data] : []));
      break;
    case 'warn':
      console.warn(formatted, ...(data !== undefined ? [data] : []));
      break;
    case 'error':
      console.error(formatted, ...(data !== undefined ? [data] : []));
      break;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export const logger = {
  debug: (category: LogCategory, message: string, data?: unknown) =>
    emit('debug', category, message, data),
  info: (category: LogCategory, message: string, data?: unknown) =>
    emit('info', category, message, data),
  warn: (category: LogCategory, message: string, data?: unknown) =>
    emit('warn', category, message, data),
  error: (category: LogCategory, message: string, data?: unknown) =>
    emit('error', category, message, data),

  /** Get the last N log entries from the buffer (for diagnostics UI) */
  getBuffer: (n = 50): LogEntry[] => _logBuffer.slice(-n),

  /** Clear the in-memory buffer */
  clearBuffer: () => {
    _logBuffer.length = 0;
  },
};

// ── Backward-compatible default export (mirrors old utils/logger.ts shape) ──
// Allows gradual migration without touching every import site.
export default {
  log: (...args: unknown[]) => emit('info', 'GENERAL', String(args[0]), args.slice(1)),
  warn: (...args: unknown[]) => emit('warn', 'GENERAL', String(args[0]), args.slice(1)),
  error: (...args: unknown[]) => emit('error', 'GENERAL', String(args[0]), args.slice(1)),
  debug: (...args: unknown[]) => emit('debug', 'GENERAL', String(args[0]), args.slice(1)),
};

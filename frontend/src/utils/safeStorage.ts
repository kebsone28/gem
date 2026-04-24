 
import logger from './logger';

// simple wrapper around localStorage that protects against oversized values

const MAX_CHARS = 1_000_000; // ~1 MB per entry

function isTooLarge(value: string | null): boolean {
  return value !== null && value.length > MAX_CHARS;
}

export function getItem(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (isTooLarge(val)) {
      logger.warn(`safeStorage: key "${key}" is too large (${val?.length} chars), purging`);
      localStorage.removeItem(key);
      return null;
    }
    return val;
  } catch (e) {
    logger.error('safeStorage.getItem error', e);
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    if (isTooLarge(value)) {
      logger.warn(
        `safeStorage: attempt to store oversized value under "${key}" (${value.length} chars), ignoring`
      );
      return;
    }
    localStorage.setItem(key, value);
  } catch (e) {
    logger.error('safeStorage.setItem error', e);
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    logger.error('safeStorage.removeItem error', e);
  }
}

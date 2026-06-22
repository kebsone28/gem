  
/**
 * @deprecated Utilisez `import { logger } from '../services/logger'` à la place.
 * Ce fichier est conservé pour la compatibilité ascendante.
 * Il réexporte le logger structuré depuis services/logger.ts.
 */
import { logger as _structured, default as _legacy } from '../services/logger';

// Backward-compat: default export uses legacy variadic API (GENERAL category),
// plus .info() from the structured API (which legacy doesn't have).
export const logger: Record<string, unknown> = {
  log: _legacy.log,
  info: _structured.info,
  warn: _legacy.warn,
  error: _legacy.error,
  debug: _legacy.debug,
  getBuffer: _structured.getBuffer,
  clearBuffer: _structured.clearBuffer,
} as any;

export default logger;

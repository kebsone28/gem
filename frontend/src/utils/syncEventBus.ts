 
/**
 * Sync Event Bus — Notifie terrain et bordereau des changements
 *
 * Les pages s'abonnent aux événements et se rafraîchissent automatiquement
 * Support WebSocket (Socket.io) pour notifications du backend
 */

import logger from './logger';

// ─── ANTI-DOUBLON EVENTS ──────────────────────────────────────────────────────
/** Horodatage de la dernière émission par clé d'event */
const _lastEventMap = new Map<string, number>();

/**
 * Retourne true si l'event peut être traité, false si trop récent (anti-doublon).
 * @param key     Identifiant unique de l'event (ex: 'kobo:syncComplete')
 * @param cooldown Fenêtre de déduplication en ms (défaut: 2000ms)
 */
export const shouldProcessEvent = (key: string, cooldown = 2000): boolean => {
  const now = Date.now();
  const last = _lastEventMap.get(key) ?? 0;
  if (now - last < cooldown) return false;
  _lastEventMap.set(key, now);
  return true;
};

class SyncEventBus {
  private listeners: Map<string, Set<(data?: unknown) => void>> = new Map();
  private socket: { on: (event: string, cb: (data: unknown) => void) => void } | null = null;

  // Initialize WebSocket connection to listen for backend events
  initSocket(socketInstance: { on: (event: string, cb: (data: unknown) => void) => void }) {
    if (this.socket === socketInstance) return;
    this.socket = socketInstance;

    // Listen for backend events
    if (this.socket) {
      this.socket.on('import:complete', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received import:complete from backend');
        this.emit('import:complete', data);
      });

      this.socket.on('kobo:syncComplete', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received kobo:syncComplete from backend');
        this.emit('kobo:syncComplete', data);
      });

      this.socket.on('project:reset', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received project:reset from backend');
        this.emit('project:reset', data);
      });

      this.socket.on('mission:submitted', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received mission:submitted from backend');
        this.emit('mission:submitted', data);
      });

      this.socket.on('mission:update', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received mission:update from backend');
        this.emit('mission:update', data);
      });

      this.socket.on('mission:certified', (data: unknown) => {
        logger.debug('[SYNC-BUS] Received mission:certified from backend');
        this.emit('mission:certified', data);
      });
    }
  }

  subscribe(eventType: string, callback: (data?: unknown) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  emit(eventType: string, data?: unknown) {
    // Pas de dedup ici — shouldProcessEvent est appelée côté abonné si nécessaire
    logger.debug(`[SYNC-BUS] Event: ${eventType}`, data);
    this.listeners.get(eventType)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        logger.error(`[SYNC-BUS] Error in listener for ${eventType}:`, err);
      }
    });
  }

  clear() {
    this.listeners.clear();
  }
}

export const syncEventBus = new SyncEventBus();

// Event Types (used across app)
export const SYNC_EVENTS = {
  // When manual import completes
  IMPORT_COMPLETE: 'import:complete',

  // When Kobo sync completes
  KOBO_SYNC_COMPLETE: 'kobo:syncComplete',

  // When any data affected the DB and views need refresh
  DATA_CHANGED: 'data:changed',

  // When project data is reset
  PROJECT_RESET: 'project:reset',

  // Mission Events (Phase 3 Decoupling)
  MISSION_SAVED: 'mission:saved',
  MISSION_SUBMITTED: 'mission:submitted',
  MISSION_UPDATED: 'mission:update',
  MISSION_CERTIFIED: 'mission:certified',
} as const;

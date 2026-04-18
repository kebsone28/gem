/**
 * Sync Event Bus — Notifie terrain et bordereau des changements
 *
 * Les pages s'abonnent aux événements et se rafraîchissent automatiquement
 * Support WebSocket (Socket.io) pour notifications du backend
 */

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
  private listeners: Map<string, Set<Function>> = new Map();
  private socket: any = null;

  // Initialize WebSocket connection to listen for backend events
  initSocket(socketInstance: any) {
    this.socket = socketInstance;

    // Listen for backend events
    if (this.socket) {
      this.socket.on('import:complete', (data: any) => {
        console.log('[SYNC-BUS] Received import:complete from backend');
        this.emit('import:complete', data);
      });

      this.socket.on('kobo:syncComplete', (data: any) => {
        console.log('[SYNC-BUS] Received kobo:syncComplete from backend');
        this.emit('kobo:syncComplete', data);
      });

      this.socket.on('project:reset', (data: any) => {
        console.log('[SYNC-BUS] Received project:reset from backend');
        this.emit('project:reset', data);
      });
    }
  }

  subscribe(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  emit(eventType: string, data?: any) {
    // Pas de dedup ici — shouldProcessEvent est appelée côté abonné si nécessaire
    console.log(`[SYNC-BUS] Event: ${eventType}`, data);
    this.listeners.get(eventType)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[SYNC-BUS] Error in listener for ${eventType}:`, err);
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
  MISSION_CERTIFIED: 'mission:certified',
} as const;

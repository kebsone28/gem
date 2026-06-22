/**
 * 🔀 GED OS Kernel — EventBus
 * Bus d'événements centralisé pour la communication inter-modules.
 * Implémente le pattern Publisher/Subscriber avec typage fort.
 *
 * Architecture:
 *  - Les modules émettent des DomainEvents via EventBus.emit()
 *  - Les modules s'abonnent à des événements via EventBus.on()
 *  - Le Kernel trace tous les événements pour l'audit
 */

import logger from '@services/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventPayload = Record<string, unknown>;

export interface DomainEvent<T extends EventPayload = EventPayload> {
  /** Identifiant unique de l'événement (uuid) */
  id: string;
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** Module source (ex: 'terrain', 'mission') */
  source: string;
  /** Type d'événement (ex: 'TERRAIN_DATA_UPDATED') */
  type: string;
  /** Données métier associées */
  payload: T;
  /** Metadata optionnelle (tenantId, userId, correlationId) */
  meta?: {
    tenantId?: string;
    userId?: string;
    projectId?: string;
    correlationId?: string;
  };
}

export type EventHandler<T extends EventPayload = EventPayload> = (
  event: DomainEvent<T>
) => void | Promise<void>;

export type UnsubscribeFn = () => void;

// ─── Catalogue des événements du Kernel ──────────────────────────────────────

export const KERNEL_EVENTS = {
  // --- Terrain ---
  TERRAIN_DATA_UPDATED:     'TERRAIN_DATA_UPDATED',
  TERRAIN_HOUSEHOLD_STATUS: 'TERRAIN_HOUSEHOLD_STATUS',
  TERRAIN_GRAPPE_CHANGED:   'TERRAIN_GRAPPE_CHANGED',
  TERRAIN_OFFLINE_SYNCED:   'TERRAIN_OFFLINE_SYNCED',

  // --- Missions ---
  MISSION_CREATED:          'MISSION_CREATED',
  MISSION_VALIDATED:        'MISSION_VALIDATED',
  MISSION_APPROVED:         'MISSION_APPROVED',
  MISSION_ARCHIVED:         'MISSION_ARCHIVED',

  // --- Planning ---
  PLANNING_UPDATED:         'PLANNING_UPDATED',
  PHASE_COMPLETED:          'PHASE_COMPLETED',

  // --- Logistique ---
  STOCK_ALERT:              'STOCK_ALERT',
  DELIVERY_COMPLETED:       'DELIVERY_COMPLETED',
  OM_CREATED:               'OM_CREATED',

  // --- Finance ---
  BUDGET_THRESHOLD:         'BUDGET_THRESHOLD',
  PAYMENT_REGISTERED:       'PAYMENT_REGISTERED',

  // --- Système ---
  MODULE_LOADED:            'MODULE_LOADED',
  MODULE_UNLOADED:          'MODULE_UNLOADED',
  SYNC_COMPLETED:           'SYNC_COMPLETED',
  USER_CONTEXT_CHANGED:     'USER_CONTEXT_CHANGED',
  PROJECT_CHANGED:          'PROJECT_CHANGED',

  // --- IA ---
  AI_CONTEXT_UPDATED:       'AI_CONTEXT_UPDATED',
  AI_SUGGESTION_AVAILABLE:  'AI_SUGGESTION_AVAILABLE',
} as const;

export type KernelEventType = typeof KERNEL_EVENTS[keyof typeof KERNEL_EVENTS];

// ─── EventBus Implementation ─────────────────────────────────────────────────

interface Subscription {
  handler: EventHandler<any>;
  once: boolean;
}

class GedOsEventBus {
  private subscriptions = new Map<string, Set<Subscription>>();
  private history: DomainEvent[] = [];
  private readonly MAX_HISTORY = 200;
  private debugMode = false;

  /** Active le mode debug (log tous les events dans la console) */
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  /**
   * S'abonner à un type d'événement.
   * @returns Une fonction pour se désabonner
   */
  on<T extends EventPayload = EventPayload>(
    eventType: string,
    handler: EventHandler<T>
  ): UnsubscribeFn {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    const subscription: Subscription = { handler, once: false };
    this.subscriptions.get(eventType)!.add(subscription);

    return () => {
      this.subscriptions.get(eventType)?.delete(subscription);
    };
  }

  /**
   * S'abonner à un événement une seule fois.
   * @returns Une fonction pour se désabonner avant déclenchement
   */
  once<T extends EventPayload = EventPayload>(
    eventType: string,
    handler: EventHandler<T>
  ): UnsubscribeFn {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    const subscription: Subscription = { handler, once: true };
    this.subscriptions.get(eventType)!.add(subscription);

    return () => {
      this.subscriptions.get(eventType)?.delete(subscription);
    };
  }

  /**
   * Émettre un événement vers tous les abonnés.
   * Les handlers async sont exécutés sans await (fire-and-forget).
   */
  emit<T extends EventPayload = EventPayload>(
    eventType: string,
    payload: T,
    source: string,
    meta?: DomainEvent['meta']
  ): DomainEvent<T> {
    const event: DomainEvent<T> = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source,
      type: eventType,
      payload,
      meta,
    };

    // Historique circulaire
    this.history.push(event as DomainEvent);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    if (this.debugMode) {
      console.debug(
        `[EventBus] 📡 ${eventType} from ${source}`,
        payload
      );
    }

    const subs = this.subscriptions.get(eventType);
    if (!subs || subs.size === 0) return event;

    const toRemove: Subscription[] = [];

    subs.forEach((sub) => {
      try {
        const result = sub.handler(event);
        if (result instanceof Promise) {
          result.catch((err) =>
            logger.error(`[EventBus] Handler error for ${eventType}:`, err)
          );
        }
      } catch (err) {
        logger.error(`[EventBus] Sync handler error for ${eventType}:`, err);
      }

      if (sub.once) toRemove.push(sub);
    });

    toRemove.forEach((sub) => subs.delete(sub));

    return event;
  }

  /** Retourne l'historique des événements récents */
  getHistory(eventType?: string): DomainEvent[] {
    if (eventType) {
      return this.history.filter((e) => e.type === eventType);
    }
    return [...this.history];
  }

  /** Retourne le nombre d'abonnés actifs pour un type d'événement */
  getSubscriberCount(eventType: string): number {
    return this.subscriptions.get(eventType)?.size ?? 0;
  }

  /** Supprime tous les abonnements (utile pour les tests) */
  clear() {
    this.subscriptions.clear();
    this.history = [];
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const EventBus = new GedOsEventBus();

// Active le debug mode en développement
if (import.meta.env?.DEV) {
  EventBus.setDebugMode(false); // Mettre à true pour déboguer les events
}

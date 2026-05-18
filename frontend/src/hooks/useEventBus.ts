/**
 * 🔀 GED OS Kernel — useEventBus Hook
 * Hook React pour s'abonner proprement à l'EventBus depuis n'importe quel composant.
 * Gère automatiquement le cleanup au unmount pour éviter les memory leaks.
 *
 * @example
 * // Dans un composant React
 * useEventBus('TERRAIN_DATA_UPDATED', (event) => {
 *   console.log('Terrain data changed:', event.payload);
 * });
 *
 * @example
 * // Émettre un événement
 * const { emit } = useEventBus();
 * emit('MISSION_CREATED', { missionId: '123' }, 'mission');
 */

import { useEffect, useCallback } from 'react';
import { EventBus, type EventHandler, type EventPayload, type DomainEvent } from '../events/EventBus';

/**
 * S'abonne à un événement du Kernel et nettoie automatiquement au unmount.
 */
export function useEventBus<T extends EventPayload = EventPayload>(
  eventType: string,
  handler: EventHandler<T>,
  deps?: React.DependencyList
): void;

/**
 * Retourne une fonction emit sans s'abonner à un événement.
 */
export function useEventBus(): {
  emit: typeof EventBus.emit;
  history: (eventType?: string) => DomainEvent[];
};

export function useEventBus<T extends EventPayload = EventPayload>(
  eventType?: string,
  handler?: EventHandler<T>,
  deps: React.DependencyList = []
): void | { emit: typeof EventBus.emit; history: (eventType?: string) => DomainEvent[] } {
  const stableHandler = useCallback(
    handler ?? (() => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    if (!eventType || !handler) return;

    const unsubscribe = EventBus.on<T>(eventType, stableHandler as EventHandler<T>);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, stableHandler]);

  if (!eventType) {
    return {
      emit: EventBus.emit.bind(EventBus),
      history: EventBus.getHistory.bind(EventBus),
    };
  }
}

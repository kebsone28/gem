/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect, useRef } from 'react';
import { syncEventBus, SYNC_EVENTS, shouldProcessEvent } from '../utils/syncEventBus';

/**
 * Hook pour s'abonner aux changements de données
 * Trigger le callback quand import/kobo sync/project reset arrive
 *
 * ✅ V2: Protection anti-doublon via shouldProcessEvent (cooldown 3s par event)
 */
export function useSyncListener(onDataChanged: (source: string) => void) {
  const callbackRef = useRef(onDataChanged);

  useEffect(() => {
    callbackRef.current = onDataChanged;
  }, [onDataChanged]);

  useEffect(() => {
    const COOLDOWN_MS = 3000; // évite les rafraîchissements répétés dans la même fenêtre

    const unsubscribeImport = syncEventBus.subscribe(SYNC_EVENTS.IMPORT_COMPLETE, () => {
      if (!shouldProcessEvent('listener:import', COOLDOWN_MS)) return;
      callbackRef.current('import');
    });

    const unsubscribeKobo = syncEventBus.subscribe(SYNC_EVENTS.KOBO_SYNC_COMPLETE, () => {
      if (!shouldProcessEvent('listener:kobo', COOLDOWN_MS)) return;
      callbackRef.current('kobo');
    });

    const unsubscribeReset = syncEventBus.subscribe(SYNC_EVENTS.PROJECT_RESET, () => {
      if (!shouldProcessEvent('listener:reset', COOLDOWN_MS)) return;
      callbackRef.current('reset');
    });

    return () => {
      unsubscribeImport();
      unsubscribeKobo();
      unsubscribeReset();
    };
  }, []);
}

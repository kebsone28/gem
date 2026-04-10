import { useEffect, useRef } from 'react';
import { syncEventBus, SYNC_EVENTS } from '../utils/syncEventBus';

/**
 * Hook pour s'abonner aux changements de données
 * Trigger le callback quand import/kobo sync/project reset arrive
 */
export function useSyncListener(onDataChanged: (source: string) => void) {
  const callbackRef = useRef(onDataChanged);

  useEffect(() => {
    callbackRef.current = onDataChanged;
  }, [onDataChanged]);

  useEffect(() => {
    // S'abonner à tous les événements qui affectent les données
    const unsubscribeImport = syncEventBus.subscribe(SYNC_EVENTS.IMPORT_COMPLETE, () =>
      callbackRef.current('import')
    );

    const unsubscribeKobo = syncEventBus.subscribe(SYNC_EVENTS.KOBO_SYNC_COMPLETE, () =>
      callbackRef.current('kobo')
    );

    const unsubscribeReset = syncEventBus.subscribe(SYNC_EVENTS.PROJECT_RESET, () =>
      callbackRef.current('reset')
    );

    return () => {
      unsubscribeImport();
      unsubscribeKobo();
      unsubscribeReset();
    };
  }, []);
}

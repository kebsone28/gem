 
import { useEffect, useRef } from 'react';
import { useSync } from '../contexts/SyncContext';
import logger from '../utils/logger';

export function useBackgroundSync() {
  const { forceSync } = useSync();
  const syncInitializedRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-mount
    if (syncInitializedRef.current) {
      return;
    }
    syncInitializedRef.current = true;
    logger.log('🔄 [BackgroundSync] Initializing engine...');

    let isSyncing = false;

    const safeSync = async () => {
      if (!navigator.onLine) {
        logger.log('📡 [BackgroundSync] Offline, skipping background sync.');
        return;
      }
      if (document.hidden) {
        logger.log('👁️ [BackgroundSync] App hidden, skipping background sync.');
        return;
      }
      if (isSyncing) return;

      isSyncing = true;
      try {
        await forceSync();
      } catch (err) {
        logger.error('Erreur durant SafeSync', err);
      } finally {
        isSyncing = false;
      }
    };

    // Lancement initial
    safeSync();

    // Reprise automatique à la connexion internet
    window.addEventListener('online', safeSync);

    // Boucle 10 minutes
    const SYNC_INTERVAL = 10 * 60 * 1000;
    const intervalId = setInterval(safeSync, SYNC_INTERVAL);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', safeSync);
    };
  }, [forceSync]);
}

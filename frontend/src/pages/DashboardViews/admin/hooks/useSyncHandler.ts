/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSync } from '../../../../hooks/useSync';
import logger from '../../../../utils/logger';

export function useSyncHandler(onSyncComplete?: () => Promise<void>) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { forceSync } = useSync();

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    const toastId = toast.loading('Synchronisation en cours...');
    
    try {
      await forceSync();
      // Wait for backend to finalize pull
      await new Promise((r) => setTimeout(r, 1500));
      
      if (onSyncComplete) {
        await onSyncComplete();
      }
      
      toast.success('Synchronisation réussie !', { id: toastId });
    } catch (err) {
      logger.error('handleSync failed', err);
      toast.error('Erreur de synchronisation', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, forceSync, onSyncComplete]);

  return { isSyncing, handleSync };
}

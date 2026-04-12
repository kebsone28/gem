import React, { createContext, useContext, useCallback } from 'react';
import * as safeStorage from '../utils/safeStorage';

interface SyncContextType {
  lastSync: string | null;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

/**
 * SyncProvider - Minimalist Version
 *
 * Volatile state and background logic have been moved to useOfflineSync and BackgroundServices
 * to prevent root-level re-render loops.
 */
export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lastSync = safeStorage.getItem('last_sync_timestamp');

  const forceSync = useCallback(async () => {
    // Dispatches a manual sync event that BackgroundServices can pick up
    window.dispatchEvent(new CustomEvent('sync:force'));
  }, []);

  return <SyncContext.Provider value={{ lastSync, forceSync }}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

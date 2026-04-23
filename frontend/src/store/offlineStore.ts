 
/**
 * Offline Store (Zustand + persist + subscribeWithSelector)
 * Advanced offline-first state with connection type tracking.
 * Updated by offlineService.ts — components read from here.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

export type ConnectionType = 'wifi' | 'cellular' | 'unknown';

export interface OfflineState {
  // Network status
  isOnline: boolean;
  lastOnlineAt: number | null; // Unix timestamp ms
  connectionType: ConnectionType;

  // UI state
  showReconnected: boolean;

  // Sync progress (driven by syncService)
  syncInProgress: boolean;

  // Actions (called by offlineService & syncService)
  setOnlineStatus: (online: boolean) => void;
  setLastOnlineAt: (timestamp: number) => void;
  setConnectionType: (type: ConnectionType) => void;
  setShowReconnected: (show: boolean) => void;
  setSyncInProgress: (inProgress: boolean) => void;
}

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        isOnline: navigator.onLine,
        lastOnlineAt: navigator.onLine ? Date.now() : null,
        connectionType: 'unknown',

        showReconnected: false,
        syncInProgress: false,

        setOnlineStatus: (online) => set({ isOnline: online }),
        setLastOnlineAt: (timestamp) => set({ lastOnlineAt: timestamp }),
        setConnectionType: (type) => set({ connectionType: type }),
        setShowReconnected: (show) => set({ showReconnected: show }),
        setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      }),
      {
        name: 'gem-offline-store',
        partialize: (state) => ({
          lastOnlineAt: state.lastOnlineAt,
          connectionType: state.connectionType,
        }),
      }
    )
  )
);

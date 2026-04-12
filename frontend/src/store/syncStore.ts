/**
 * Sync Store (Zustand + persist + subscribeWithSelector)
 * Central state for all sync operations.
 * Updated by syncService.ts — components read from here.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { ConflictRecord } from '../services/sync/conflictResolver';

export interface SyncState {
  // Counts
  pendingCount: number;

  // Status flags
  isSyncing: boolean;
  lastSyncAt: number | null; // Unix timestamp ms
  lastSyncError: string | null;

  // Conflict tracking
  conflicts: ConflictRecord[];
  lastResolvedAt: number | null;

  // Actions (called by syncService)
  setPendingCount: (count: number) => void;
  setIsSyncing: (value: boolean) => void;
  setSyncSuccess: (timestamp: number) => void;
  setSyncError: (message: string) => void;
  clearError: () => void;

  addConflicts: (records: ConflictRecord[]) => void;
  clearConflicts: () => void;
}

export const useSyncStore = create<SyncState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        pendingCount: 0,
        isSyncing: false,
        lastSyncAt: null,
        lastSyncError: null,

        conflicts: [],
        lastResolvedAt: null,

        setPendingCount: (count) => set({ pendingCount: count }),
        setIsSyncing: (value) => set({ isSyncing: value }),

        setSyncSuccess: (timestamp) =>
          set({
            isSyncing: false,
            lastSyncAt: timestamp,
            lastSyncError: null,
          }),

        setSyncError: (message) =>
          set({
            isSyncing: false,
            lastSyncError: message,
          }),

        clearError: () => set({ lastSyncError: null }),

        addConflicts: (records) =>
          set((state) => ({
            conflicts: [...state.conflicts, ...records].slice(-50), // Keep last 50
            lastResolvedAt: Date.now(),
          })),

        clearConflicts: () => set({ conflicts: [], lastResolvedAt: null }),
      }),
      {
        name: 'gem-sync-store',
        partialize: (state) => ({
          lastSyncAt: state.lastSyncAt,
          conflicts: state.conflicts,
          lastResolvedAt: state.lastResolvedAt,
        }),
      }
    )
  )
);

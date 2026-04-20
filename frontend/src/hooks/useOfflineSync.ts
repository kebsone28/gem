/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * useOfflineSync — Backward-compatible thin wrapper
 *
 * All sync logic has been extracted to:
 *   services/sync/syncService.ts      ← performSync()
 *   services/sync/backgroundSyncService.ts ← scheduling
 *   store/syncStore.ts                ← state
 *
 * This hook now only exposes what components actually need:
 *   - pendingCount  (from syncStore, kept live by BackgroundServices)
 *   - syncData      (alias for performSync — same API as before)
 *
 * Existing consumers (BackgroundServices etc.) work without changes.
 */

import { useSyncStore } from '../store/syncStore';
import { performSync } from '../services/sync/syncService';

export function useOfflineSync() {
  const pendingCount = useSyncStore((s) => s.pendingCount);

  return {
    pendingCount,
    syncData: performSync,
  };
}

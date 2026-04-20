/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * BackgroundServices
 * Thin bridge component — the ONLY reason this still exists as a React component
 * is that useLiveQuery (Dexie) requires a React context to subscribe.
 * All actual sync logic lives in services/sync/backgroundSyncService.ts.
 *
 * Responsibility: watch Dexie pendingCount live → push to syncStore.
 */
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { updatePendingCount } from '../services/sync/syncService';

export default function BackgroundServices() {
  const pendingCount = useLiveQuery(
    () => db.syncOutbox.where({ status: 'pending' }).count(),
    [],
    0
  );

  useEffect(() => {
    if (pendingCount !== undefined) {
      updatePendingCount(pendingCount);
    }
  }, [pendingCount]);

  return null;
}

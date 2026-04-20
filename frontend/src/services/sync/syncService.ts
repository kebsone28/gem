/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sync Service
 * Core push/pull synchronisation logic extracted from useOfflineSync.ts.
 * Pure module — no React. Runs independently of component lifecycle.
 * Updates syncStore and offlineStore directly.
 */

import apiClient from '../../api/client';
import { db, syncData } from '../../store/db';
import { useSyncStore } from '../../store/syncStore';
import { useOfflineStore } from '../../store/offlineStore';
import { useAuthStore } from '../../store/authStore';
import * as safeStorage from '../../utils/safeStorage';
import { logger } from '../logger';
import {
  fetchPendingBatch,
  markSynced,
  markFailed,
  getEntityType,
  countPending,
} from './queueService';
import { handleServerConflicts } from './conflictResolver';

// Module-level guard — prevents concurrent sync across the entire app lifetime
let _isSyncRunning = false;

/** Pull remote changes and apply them to the local Dexie database */
async function pullUpdates(): Promise<void> {
  const lastSync = safeStorage.getItem('last_sync_timestamp');
  logger.info('SYNC', 'Pulling server changes...', { since: lastSync });

  const response = await apiClient.get('sync/pull', {
    params: { since: lastSync, limit: 1000 },
  });

  const { timestamp, changes } = response.data;

  if (changes.projects) await syncData('projects', changes.projects);

  /* 🚫 SERVER-FIRST: Households are no longer pulled into Dexie. 
     The API /api/households is now the direct source of truth for the Map.
  if (changes.households?.length > 0) {
    logger.debug('SYNC', `Applying ${changes.households.length} household changes`, {
      ids: changes.households.slice(0, 5).map((h: Record<string, unknown>) => h.id),
      projectIds: [...new Set(changes.households.map((h: Record<string, unknown>) => h.projectId))],
    });
    const CHUNK = 100;
    for (let i = 0; i < changes.households.length; i += CHUNK) {
      await syncData('households', changes.households.slice(i, i + CHUNK));
    }
  }
  */

  if (changes.zones) await syncData('zones', changes.zones);
  if (changes.teams) await syncData('teams', changes.teams);
  if (changes.inventory) await syncData('inventory', changes.inventory);
  if (changes.expenses) await syncData('expenses', changes.expenses);
  if (changes.missions) await syncData('missions', changes.missions);

  safeStorage.setItem('last_sync_timestamp', timestamp);

  await db.sync_logs.add({
    timestamp: new Date(),
    action: `Pull réussi (${changes.households?.length ?? 0} ménages)`,
    details: { timestamp, tables: Object.keys(changes) },
  });
}

/** Trigger server-side Kobo external sync */
async function triggerKoboSync(): Promise<void> {
  const activeProjectId = safeStorage.getItem('active_project_id');
  logger.debug('SYNC', 'Triggering Kobo external sync');
  try {
    const payload = activeProjectId ? { projectId: activeProjectId } : {};
    await apiClient.post('sync/kobo', payload);
  } catch (err) {
    logger.warn('SYNC', 'Kobo background sync failed (non-critical)', err);
  }
}

/** Push locally queued items to the server in priority batches */
async function pushPendingItems(): Promise<void> {
  const LIMIT = 50;

  while (true) {
    const items = await fetchPendingBatch(LIMIT);
    if (items.length === 0) break;

    // Group items by entity type
    const batchChanges: Record<string, unknown[]> = {};
    const itemMap = new Map<string, number[]>(); // entityKey → outboxIds

    for (const item of items) {
      const entityType = getEntityType(item.endpoint);
      if (entityType === 'unknown') {
        logger.warn('SYNC', `Unknown entity for endpoint: ${item.endpoint} — marking failed`);
        await markFailed([item.id as number], 'Unknown entity type');
        continue;
      }

      const payload = { ...item.payload };

      // Ensure payload has a valid ID
      if (!payload.id || payload.id === entityType) {
        const segments = item.endpoint.split('/');
        payload.id = segments[segments.length - 1] || crypto.randomUUID();
      }

      // Critical validation: households must have zoneId
      if (entityType === 'households' && !payload.zoneId) {
        logger.warn('SYNC', `Household ${payload.id} missing zoneId — skipping`);
        await markFailed([item.id as number], 'Missing required field: zoneId');
        continue;
      }

      if (!batchChanges[entityType]) batchChanges[entityType] = [];
      batchChanges[entityType].push(payload);

      const key = `${entityType}:${payload.id}`;
      itemMap.set(key, [...(itemMap.get(key) ?? []), item.id as number]);
    }

    if (Object.keys(batchChanges).length === 0) {
      // Everything in the batch was invalid — all already marked failed
      break;
    }

    try {
      const response = await apiClient.post('sync/push', { changes: batchChanges });
      const { results } = response.data;

      // ── Delete successfully synced items ────────────────────────────
      const idsToDelete: number[] = [];
      for (const s of results?.success ?? []) {
        const type = s.type.endsWith('s') ? s.type : `${s.type}s`;
        const key = `${type}:${s.id}`;
        const outboxIds = itemMap.get(key) ?? [];
        const outboxId = outboxIds.shift();
        if (outboxId) idsToDelete.push(outboxId);
      }
      await markSynced(idsToDelete);
      logger.info('SYNC', `Push batch: ${idsToDelete.length}/${items.length} synced`);

      // ── Handle errors ────────────────────────────────────────────────
      if (results?.errors?.length > 0) {
        logger.warn('SYNC', `Push batch: ${results.errors.length} item(s) with errors`);
        for (const e of results.errors) {
          const type = e.type.endsWith('s') ? e.type : `${e.type}s`;
          const key = `${type}:${e.id}`;
          const outboxIds = itemMap.get(key) ?? [];
          const outboxId = outboxIds.shift();
          if (outboxId) await markFailed([outboxId], e.error);
        }
      }

      // ── Handle conflicts from server ─────────────────────────────────
      if (results?.conflicts?.length > 0) {
        const resolvedKeys = await handleServerConflicts(results.conflicts);

        // Clear outbox for resolved items to prevent infinite retry loop
        const conflictIdsToDelete: number[] = [];
        for (const key of resolvedKeys) {
          const outboxIds = itemMap.get(key) ?? [];
          const outboxId = outboxIds.shift();
          if (outboxId) conflictIdsToDelete.push(outboxId);
        }

        if (conflictIdsToDelete.length > 0) {
          await markSynced(conflictIdsToDelete);
          logger.info(
            'SYNC',
            `Cleared ${conflictIdsToDelete.length} resolved conflict(s) from outbox`
          );
        }
      }
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;

      if (status === 401) {
        logger.error('SYNC', '401 Unauthorized — stopping push loop');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        break;
      }

      if (!status || status >= 500 || status === 429) {
        // Network or server error — stop this cycle, will retry in next interval
        logger.error('SYNC', 'Push batch fatal error — aborting cycle', err);
        throw err;
      }

      // 4xx client errors — mark batch as failed to progress
      logger.warn('SYNC', `Push batch 4xx ${status} — marking batch as failed`);
      await markFailed(
        items.map((i) => i.id as number),
        `HTTP ${status}`
      );
      break;
    }

    if (items.length < LIMIT) break;
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Main sync cycle: push → pull → kobo.
 * Guards against concurrent execution.
 * Updates syncStore and offlineStore throughout.
 */
export async function performSync(): Promise<void> {
  const { user } = useAuthStore.getState();
  const { isOnline } = useOfflineStore.getState();

  if (!user || !isOnline || _isSyncRunning) {
    if (_isSyncRunning) logger.debug('SYNC', 'Sync already in progress — skipping');
    return;
  }

  _isSyncRunning = true;

  const syncStore = useSyncStore.getState();
  const offlineStore = useOfflineStore.getState();

  syncStore.setIsSyncing(true);
  offlineStore.setSyncInProgress(true);

  try {
    logger.info('SYNC', 'Starting sync cycle');

    await pushPendingItems();
    await pullUpdates();
    await triggerKoboSync();
    await pullUpdates();

    // Update pending count after cycle
    const remaining = await countPending();
    syncStore.setPendingCount(remaining);
    syncStore.setSyncSuccess(Date.now());

    logger.info('SYNC', `Sync cycle complete — ${remaining} pending item(s) remaining`);
  } catch (err) {
    logger.error('SYNC', 'Critical sync failure', err);
    syncStore.setSyncError(err instanceof Error ? err.message : 'Unknown sync error');
  } finally {
    _isSyncRunning = false;
    offlineStore.setSyncInProgress(false);
  }
}

/** Update the pending count in syncStore (called by Dexie live query in hook) */
export function updatePendingCount(count: number): void {
  useSyncStore.getState().setPendingCount(count);
}

/** Bulk import households */
export async function importBulk(data: any): Promise<{ success: boolean; count: number }> {
  const response = await apiClient.post('sync/import-bulk', data);
  return response.data;
}

/** Clear entity data on server */
export async function clearEntity(entity: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`sync/clear/${entity}`);
  return response.data;
}

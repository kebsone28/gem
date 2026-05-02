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
import toast from 'react-hot-toast';
import {
  countPending,
} from './queueService';

// Module-level guard — prevents concurrent sync across the entire app lifetime
let _isSyncRunning = false;

// ── CIRCUIT BREAKER ─────────────────────────────────────────────────────────
const RTT_THRESHOLD_MS = 4000;       // Tolérance accrue pour les zones à faible couverture (4s)
const CB_FAILURE_LIMIT = 3;          // Déclenchement après 3 échecs consécutifs
const CB_RESET_TIMEOUT_MS = 2 * 60 * 1000; // Tentative de reconnexion après 2 minutes (au lieu de 5)

let _cbFailures = 0;
let _cbOpenAt: number | null = null;

function isCircuitOpen(): boolean {
  if (_cbOpenAt === null) return false;
  if (Date.now() - _cbOpenAt > CB_RESET_TIMEOUT_MS) {
    // Auto-reset after timeout — try again (half-open)
    _cbFailures = 0;
    _cbOpenAt = null;
    logger.info('SYNC', '🔌 Circuit Breaker: reset — attempting reconnection');
    return false;
  }
  return true;
}

/** Measure RTT to the backend health endpoint */
async function measureRTT(): Promise<number | null> {
  try {
    const start = Date.now();
    await apiClient.get('health', { timeout: 3000 });
    return Date.now() - start;
  } catch {
    return null; // null = unreachable
  }
}

/** Run the circuit breaker check before any sync. Returns true if sync is allowed. */
async function canSync(): Promise<boolean> {
  if (isCircuitOpen()) {
    const remaining = Math.round((CB_RESET_TIMEOUT_MS - (Date.now() - (_cbOpenAt ?? 0))) / 1000);
    logger.warn('SYNC', `⚡ Circuit Breaker OPEN — sync suspended (${remaining}s remaining)`);
    return false;
  }

  const rtt = await measureRTT();
  const offlineStore = useOfflineStore.getState();

  if (rtt === null || rtt > RTT_THRESHOLD_MS) {
    _cbFailures++;
    offlineStore.setQualityDegraded(true, rtt);
    logger.warn('SYNC', `📶 Degraded network detected (RTT=${rtt}ms, failures=${_cbFailures}/${CB_FAILURE_LIMIT})`);

    if (_cbFailures >= CB_FAILURE_LIMIT) {
      _cbOpenAt = Date.now();
      logger.error('SYNC', '⚡ Circuit Breaker TRIPPED — sync suspended for 5 minutes');
      toast.error('⚡ Connexion trop instable — sync suspendue 5 min', {
        id: 'cb-tripped',
        duration: 8000,
        icon: '📵',
      });
    } else {
      toast(`📶 Connexion dégradée (${rtt ?? '?'}ms) — tentative ${_cbFailures}/${CB_FAILURE_LIMIT}`, {
        id: 'cb-degraded',
        duration: 4000,
        style: { background: '#78350f', color: '#fde68a' },
      });
    }
    return false;
  }

  // Connection is healthy
  if (_cbFailures > 0) {
    logger.info('SYNC', `✅ Circuit Breaker: connection restored (RTT=${rtt}ms)`);
    toast.success(`✅ Connexion rétablie (${rtt}ms)`, { id: 'cb-restored', duration: 3000 });
  }
  _cbFailures = 0;
  offlineStore.setQualityDegraded(false, rtt);
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

export function hasSyncAuthContext(): boolean {
  const { user, isAuthenticated } = useAuthStore.getState();
  const token = safeStorage.getItem('access_token');
  const isValidToken =
    !!token && token !== 'undefined' && token !== 'null' && token.length >= 20;
  const isOnLoginPage =
    typeof window !== 'undefined' && window.location.pathname === '/login';

  return !!user && isAuthenticated && isValidToken && !isOnLoginPage;
}

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
    let payload: Record<string, string> = {};

    if (activeProjectId) {
      const projectExists = await db.projects.get(activeProjectId);
      if (projectExists) {
        payload = { projectId: activeProjectId };
      } else {
        logger.warn('SYNC', `Skipping stale active project during Kobo sync: ${activeProjectId}`);
        safeStorage.removeItem('active_project_id');
      }
    }

    await apiClient.post('sync/kobo', payload);
  } catch (err) {
    logger.warn('SYNC', 'Kobo background sync failed (non-critical)', err);
  }
}

/** Purge locally queued workflow mutations from old app versions */
async function pushPendingItems(): Promise<void> {
  const legacyItems = await db.syncOutbox.toArray();
  if (legacyItems.length > 0) {
    await db.syncOutbox.clear();
    logger.warn(
      'SYNC',
      `Cleared ${legacyItems.length} legacy local mutation(s). Official workflows are server-first.`
    );
  }
}

/**
 * Main sync cycle: push → pull → kobo.
 * Guards against concurrent execution.
 * Updates syncStore and offlineStore throughout.
 */
export async function performSync(): Promise<void> {
  const { isOnline } = useOfflineStore.getState();

  if (!hasSyncAuthContext() || !isOnline || _isSyncRunning) {
    if (_isSyncRunning) logger.debug('SYNC', 'Sync already in progress — skipping');
    return;
  }

  // ── Circuit Breaker gate ────────────────────────────────────────────────
  const allowed = await canSync();
  if (!allowed) return;
  // ───────────────────────────────────────────────────────────────────────

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
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      logger.warn('SYNC', 'Unauthorized sync detected — clearing auth session');
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }
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

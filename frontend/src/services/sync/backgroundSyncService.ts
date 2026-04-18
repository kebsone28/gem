/**
 * Background Sync Service
 * Pure module — NO React dependency.
 * Manages all periodic and event-driven sync scheduling.
 * Initialized ONCE in main.tsx. Runs for the entire app lifetime.
 *
 * ✅ V2: Uses SyncEngine for dedup, priority queue, and safe retry.
 */

import { performSync } from './syncService';
import { syncEngine } from '../../core/sync/syncEngine';
import { shouldProcessEvent } from '../../utils/syncEventBus';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _initialized = false;
let _intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Creates a sync job and enqueues it via the SyncEngine.
 * The engine handles dedup, priority, and retry internally.
 */
function scheduleSync(source: string, priority: 'high' | 'normal' | 'low' = 'normal') {
  // Protection niveau event bus (cooldown 2s par source)
  if (!shouldProcessEvent(`bg-sync:${source}`, 2000)) {
    logger.debug('SYNC', `Event bus dedup — ignoring rapid trigger: ${source}`);
    return;
  }

  logger.info('SYNC', `Sync triggered by: ${source}`);

  syncEngine.enqueue({
    id: crypto.randomUUID(),
    source,
    priority,
    timestamp: Date.now(),
    execute: performSync,
  });
}

/**
 * Start background sync scheduling.
 * Idempotent — safe to call multiple times.
 */
export function startBackgroundSync(): () => void {
  if (_initialized) {
    logger.warn('SYNC', 'startBackgroundSync called more than once — skipping');
    return stopBackgroundSync;
  }
  _initialized = true;

  logger.info('SYNC', 'Background sync service started');

  // ── Periodic sync ────────────────────────────────────────────────────────
  _intervalId = setInterval(() => {
    scheduleSync('periodic-interval', 'low');
  }, SYNC_INTERVAL_MS);

  // ── Manual force sync from UI ────────────────────────────────────────────
  const handleForceSync = () => scheduleSync('sync:force event', 'high');

  // ── Auto-sync on reconnect ───────────────────────────────────────────────
  const handleOnline = () => scheduleSync('network-restored', 'high');

  window.addEventListener('sync:force', handleForceSync);
  window.addEventListener('online', handleOnline);

  return stopBackgroundSync;

  function stopBackgroundSync() {
    if (_intervalId) clearInterval(_intervalId);
    window.removeEventListener('sync:force', handleForceSync);
    window.removeEventListener('online', handleOnline);
    _initialized = false;
    _intervalId = null;
    logger.info('SYNC', 'Background sync service stopped');
  }
}

/**
 * Trigger an immediate high-priority sync (ex: post import, post kobo).
 * Always bypasses cooldown by using a unique source key.
 */
export function triggerImmediateSync(source = 'immediate'): void {
  logger.info('SYNC', `Immediate sync requested by: ${source}`);
  syncEngine.enqueue({
    id: crypto.randomUUID(),
    source,
    priority: 'high',
    timestamp: Date.now(),
    execute: performSync,
  });
}

/**
 * Background Sync Service
 * Pure module — NO React dependency.
 * Manages all periodic and event-driven sync scheduling.
 * Initialized ONCE in main.tsx. Runs for the entire app lifetime.
 */

import { performSync } from './syncService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY_MS = 500; // debounce on pendingCount change

let _initialized = false;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSync(source: string) {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    logger.info('SYNC', `Sync triggered by: ${source}`);
    await performSync();
  }, DEBOUNCE_DELAY_MS);
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
    logger.debug('SYNC', 'Periodic sync tick');
    debouncedSync('periodic-interval');
  }, SYNC_INTERVAL_MS);

  // ── Manual force sync from UI ────────────────────────────────────────────
  const handleForceSync = () => debouncedSync('sync:force event');

  // ── Auto-sync on reconnect ───────────────────────────────────────────────
  const handleOnline = () => debouncedSync('network-restored');

  window.addEventListener('sync:force', handleForceSync);
  window.addEventListener('online', handleOnline);

  // Cleanup function — returned so main.tsx could call it in tests / HMR
  return stopBackgroundSync;

  function stopBackgroundSync() {
    if (_intervalId) clearInterval(_intervalId);
    if (_debounceTimer) clearTimeout(_debounceTimer);
    window.removeEventListener('sync:force', handleForceSync);
    window.removeEventListener('online', handleOnline);
    _initialized = false;
    _intervalId = null;
    _debounceTimer = null;
    logger.info('SYNC', 'Background sync service stopped');
  }
}

/** Trigger an immediate sync (bypasses debounce) */
export async function triggerImmediateSync(): Promise<void> {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  await performSync();
}

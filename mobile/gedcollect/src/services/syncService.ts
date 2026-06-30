import { performCoreSync, getCurrentBackoff, resetBackoff, isSyncActive } from './syncCore';

let syncInterval: ReturnType<typeof setTimeout> | null = null;

export async function syncPendingSubmissions() {
  const result = await performCoreSync();
  return { synced: result.synced, failed: result.failed };
}

export function startAutoSync(initialIntervalMs = 30000): void {
  stopAutoSync();
  const tick = async () => {
    await syncPendingSubmissions();
    syncInterval = setTimeout(tick, getCurrentBackoff());
  };
  syncInterval = setTimeout(tick, initialIntervalMs);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearTimeout(syncInterval);
    syncInterval = null;
  }
  resetBackoff();
}

export function isSyncing(): boolean {
  return isSyncActive();
}

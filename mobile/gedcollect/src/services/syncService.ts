import { submitFormData } from './api';
import { getPendingSubmissions, updateSubmission } from './storage';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let retryBackoff = 10000;

const MAX_BACKOFF = 300000;

export async function syncPendingSubmissions(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = await getPendingSubmissions();
    if (pending.length === 0) {
      retryBackoff = 10000;
      return { synced: 0, failed: 0 };
    }

    for (const sub of pending) {
      try {
        await submitFormData({
          formKey: sub.formKey,
          formVersion: sub.formVersion || '1.0',
          clientSubmissionId: sub.clientSubmissionId,
          status: 'submitted',
          values: sub.values,
          metadata: sub.metadata,
        });
        await updateSubmission(sub.id, { status: 'synced', errorMessage: undefined });
        synced++;
      } catch {
        const attempts = (sub.retryCount || 0) + 1;
        await updateSubmission(sub.id, { status: 'pending', errorMessage: `Tentative ${attempts} échouée`, retryCount: attempts });
        failed++;
      }
    }

    if (failed > 0 && synced === 0) {
      retryBackoff = Math.min(retryBackoff * 2, MAX_BACKOFF);
    } else {
      retryBackoff = 10000;
    }
  } finally {
    isSyncing = false;
  }
  return { synced, failed };
}

export function startAutoSync(initialIntervalMs = 30000): void {
  stopAutoSync();
  const tick = async () => {
    await syncPendingSubmissions();
    syncInterval = setTimeout(tick, retryBackoff);
  };
  syncInterval = setTimeout(tick, initialIntervalMs);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearTimeout(syncInterval);
    syncInterval = null;
  }
  retryBackoff = 10000;
}

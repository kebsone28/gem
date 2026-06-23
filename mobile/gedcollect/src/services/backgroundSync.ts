import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import { getSettings } from '@config/settings';
import { getPendingSubmissions, updateSubmission } from '@services/storage';
import { submitFormData } from '@services/api';
import { logger } from '@utils/logger';

type SyncCallback = (result: { synced: number; failed: number; errors: string[] }) => void;

let syncCallback: SyncCallback | null = null;
let isSyncing = false;

export function onSyncComplete(callback: SyncCallback): void {
  syncCallback = callback;
}

export async function performSync(): Promise<{ synced: number; failed: number; errors: string[] }> {
  if (isSyncing) return { synced: 0, failed: 0, errors: ['Sync déjà en cours'] };
  isSyncing = true;

  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      throw new Error('Aucune connexion réseau disponible');
    }
    const settings = getSettings();
    if (settings.wifiOnly && netState.type !== 'wifi') {
      throw new Error('Sync configuré WiFi uniquement');
    }

    const pending = await getPendingSubmissions();
    logger.info(`[BackgroundSync] ${pending.length} soumission(s) en attente`);

    for (const sub of pending) {
      try {
        await updateSubmission(sub.id, { status: 'syncing' });
        await submitFormData({
          formKey: sub.formKey,
          formVersion: sub.formVersion,
          clientSubmissionId: sub.id,
          status: 'submitted',
          values: sub.values as Record<string, any>,
          metadata: { ...sub.metadata, submittedAt: new Date().toISOString() },
        });
        await updateSubmission(sub.id, { status: 'synced', retryCount: sub.retryCount });
        synced++;
      } catch (e: any) {
        failed++;
        const msg = `[${sub.formKey}] ${e.message}`;
        errors.push(msg);
        logger.error('[BackgroundSync] Échec soumission', sub.id, e.message);
        const newRetry = sub.retryCount + 1;
        if (newRetry >= 5) {
          await updateSubmission(sub.id, { status: 'error', errorMessage: msg, retryCount: newRetry });
        } else {
          await updateSubmission(sub.id, { status: 'pending', errorMessage: msg, retryCount: newRetry });
        }
      }
    }
  } catch (e: any) {
    logger.error('[BackgroundSync] Sync failed', e.message);
    errors.push(e.message);
  } finally {
    isSyncing = false;
  }

  const result = { synced, failed, errors };
  syncCallback?.(result);
  return result;
}

export async function registerBackgroundTask(): Promise<void> {
  try {
    const settings = getSettings();
    if (!settings.autoSync) return;

    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: settings.syncIntervalMinutes,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
      },
      async (taskId) => {
        logger.info('[BackgroundFetch] Task started', taskId);
        await performSync();
        BackgroundFetch.finish(taskId);
      },
      (taskId) => {
        logger.warn('[BackgroundFetch] Task timeout', taskId);
        BackgroundFetch.finish(taskId);
      },
    );

    logger.info('[BackgroundSync] Task registered, status:', status);
  } catch (e: any) {
    logger.error('[BackgroundSync] Registration failed', e.message);
  }
}

export function isActiveSync(): boolean {
  return isSyncing;
}

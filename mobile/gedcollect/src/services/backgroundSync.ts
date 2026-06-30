import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import { getSettings } from '@config/settings';
import { performCoreSync, isSyncActive } from './syncCore';
import { logger } from '@utils/logger';

type SyncCallback = (result: { synced: number; failed: number; errors: string[] }) => void;

let syncCallback: SyncCallback | null = null;

export function onSyncComplete(callback: SyncCallback): void {
  syncCallback = callback;
}

export async function performSync() {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      throw new Error('Aucune connexion réseau disponible');
    }
    const settings = getSettings();
    if (settings.wifiOnly && netState.type !== 'wifi') {
      throw new Error('Sync configuré WiFi uniquement');
    }

    const result = await performCoreSync();
    syncCallback?.(result);
    return result;
  } catch (e: any) {
    logger.error('[BackgroundSync] Sync failed', e.message);
    const result = { synced: 0, failed: 0, errors: [e.message] };
    syncCallback?.(result);
    return result;
  }
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
      }
    );

    logger.info('[BackgroundSync] Task registered, status:', status);
  } catch (e: any) {
    logger.error('[BackgroundSync] Registration failed', e.message);
  }
}

export function isActiveSync(): boolean {
  return isSyncActive();
}

import { db } from '../../../store/db';
import api from '../../../api/client';
import type { MissionState, MissionAction } from './missionTypes';

/**
 * SERVICE : Sync Queue (Gestion Hors-ligne)
 * Gère la file d'attente des actions à synchroniser avec le serveur.
 */
export class MissionSyncQueue {
  private static instance: MissionSyncQueue;
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): MissionSyncQueue {
    if (!MissionSyncQueue.instance) {
      MissionSyncQueue.instance = new MissionSyncQueue();
    }
    return MissionSyncQueue.instance;
  }

  /**
   * Enregistre une action dans l'outbox locale (Dexie)
   */
  public async enqueue(missionId: string, action: MissionAction) {
    await db.syncOutbox.add({
      action: action.type,
      endpoint: `/api/missions/${missionId}/action`,
      method: 'POST',
      payload: { ...action, missionId },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    });

    // Déclencher le traitement si on est en ligne
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Traite la file d'attente des actions en attente
   */
  public async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      const pendingItems = await db.syncOutbox.where('status').equals('pending').toArray();

      for (const item of pendingItems) {
        // ⚠️ Skip items with temp IDs — they can't exist on the server yet
        if (item.endpoint.includes('/temp-')) {
          await db.syncOutbox.delete(item.id!);
          continue;
        }

        try {
          const method = item.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
          const response = await api[method](item.endpoint.replace('/api', ''), item.payload);

          if (response.data) {
            await db.syncOutbox.delete(item.id!);
          }
        } catch (err: any) {
          const status = err?.response?.status;
          const retryCount = (item.retryCount || 0) + 1;
          const isFatal = status === 401 || status === 403 || status === 404 || retryCount > 5;

          await db.syncOutbox.update(item.id!, {
            retryCount,
            lastError: `Error ${status || 'network'}`,
            status: isFatal ? 'failed' : 'pending',
          });

          if (!navigator.onLine) break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const syncQueue = MissionSyncQueue.getInstance();

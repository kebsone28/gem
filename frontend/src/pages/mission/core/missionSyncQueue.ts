import { db } from '../../../store/db';
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
      retryCount: 0
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
      const pendingItems = await db.syncOutbox
        .where('status')
        .equals('pending')
        .toArray();

      for (const item of pendingItems) {
        try {
          const response = await fetch(item.endpoint, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });

          if (response.ok) {
            await db.syncOutbox.delete(item.id!);
          } else {
            // Logique de retry incrementale
            await db.syncOutbox.update(item.id!, {
              retryCount: (item.retryCount || 0) + 1,
              lastError: `Server error: ${response.status}`,
              status: item.retryCount > 5 ? 'failed' : 'pending'
            });
          }
        } catch (err) {
          console.error('[SyncQueue] Fetch failed:', err);
          break; // Stop processing for now if network fails completely
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const syncQueue = MissionSyncQueue.getInstance();

/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../../../store/db';
import type { MissionAction } from './missionTypes';
import logger from '../../../utils/logger';

/**
 * SERVICE : Sync Queue legacy
 *
 * Les actions mission officielles sont server-first. Cette classe ne crée plus
 * d'action locale : elle purge seulement les anciennes entrées Dexie produites
 * par les versions offline-first.
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
   * Les actions mission ne sont plus acceptées en outbox locale.
   */
  public async enqueue(missionId: string, action: MissionAction) {
    logger.warn(
      `[MissionSyncQueue] Action locale ignorée (${action.type}) pour ${missionId}. Les missions doivent être enregistrées sur le serveur.`
    );
    throw new Error('La synchronisation locale des missions est désactivée.');
  }

  /**
   * Supprime les anciennes actions mission locales.
   */
  public async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const items = await db.syncOutbox.toArray();
      const legacyMissionItems = items.filter((item) =>
        String(item.endpoint || '').includes('/missions/')
      );

      if (legacyMissionItems.length > 0) {
        await db.syncOutbox.bulkDelete(
          legacyMissionItems.map((item) => item.id!).filter((id): id is number => typeof id === 'number')
        );
        logger.info(
          `[MissionSyncQueue] ${legacyMissionItems.length} ancienne(s) action(s) mission locale(s) supprimée(s).`
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * RE-MAP legacy : plus nécessaire en server-first.
   */
  public async remapTempId(tempId: string, realId: string) {
    logger.debug(`[MissionSyncQueue] Remap ignoré en server-first : ${tempId} -> ${realId}`);
  }
}

export const syncQueue = MissionSyncQueue.getInstance();

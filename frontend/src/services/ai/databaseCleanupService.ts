/**
 * 🔧 Service de Nettoyage de la Base de Données IA
 * Gère la suppression automatique des anciennes données pour optimiser l'espace
 */

import { db } from '../../store/db';
import logger from '../../utils/logger';

// Configuration du nettoyage
const CLEANUP_CONFIG = {
  // Logs d'apprentissage IA: conserver 30 jours
  aiLearningLogsRetentionDays: 30,
  // Feedback utilisateur: conserver 90 jours
  userFeedbackRetentionDays: 90,
  // Logs de synchronisation: conserver 7 jours
  syncLogsRetentionDays: 7,
  // Queue de synchronisation: nettoyer les entrées échouées de plus de 24h
  syncQueueFailedRetentionHours: 24,
};

/**
 * Supprime les anciens logs d'apprentissage IA
 */
async function cleanupAILearningLogs(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_CONFIG.aiLearningLogsRetentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    const oldLogs = await db.ai_learning_logs
      .where('timestamp')
      .below(cutoffTimestamp)
      .toArray();

    if (oldLogs.length === 0) {
      return 0;
    }

    const ids = oldLogs.map(log => log.id!);
    await db.ai_learning_logs.bulkDelete(ids);

    logger.info(`[DatabaseCleanup] Supprimé ${oldLogs.length} logs IA anciens`);
    return oldLogs.length;
  } catch (error) {
    logger.error('[DatabaseCleanup] Erreur lors du nettoyage des logs IA:', error);
    return 0;
  }
}

/**
 * Supprime les anciens feedbacks utilisateur
 */
async function cleanupUserFeedback(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_CONFIG.userFeedbackRetentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    const oldFeedback = await db.user_feedback
      .where('timestamp')
      .below(cutoffTimestamp)
      .toArray();

    if (oldFeedback.length === 0) {
      return 0;
    }

    const ids = oldFeedback.map(feedback => feedback.id!);
    await db.user_feedback.bulkDelete(ids);

    logger.info(`[DatabaseCleanup] Supprimé ${oldFeedback.length} feedbacks utilisateurs anciens`);
    return oldFeedback.length;
  } catch (error) {
    logger.error('[DatabaseCleanup] Erreur lors du nettoyage des feedbacks:', error);
    return 0;
  }
}

/**
 * Supprime les anciens logs de synchronisation
 */
async function cleanupSyncLogs(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_CONFIG.syncLogsRetentionDays);

    const oldLogs = await db.sync_logs
      .where('timestamp')
      .below(cutoffDate)
      .toArray();

    if (oldLogs.length === 0) {
      return 0;
    }

    const ids = oldLogs.map(log => log.id!);
    await db.sync_logs.bulkDelete(ids);

    logger.info(`[DatabaseCleanup] Supprimé ${oldLogs.length} logs de synchronisation anciens`);
    return oldLogs.length;
  } catch (error) {
    logger.error('[DatabaseCleanup] Erreur lors du nettoyage des logs de sync:', error);
    return 0;
  }
}

/**
 * Supprime les entrées de la queue de synchronisation échouées depuis longtemps
 */
async function cleanupSyncQueue(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - CLEANUP_CONFIG.syncQueueFailedRetentionHours);
    const cutoffTimestamp = cutoffDate.getTime();

    const oldItems = await db.syncOutbox
      .where('status')
      .equals('failed')
      .and(item => item.lastAttemptAt && item.lastAttemptAt < cutoffTimestamp)
      .toArray();

    if (oldItems.length === 0) {
      return 0;
    }

    const ids = oldItems.map(item => item.id!);
    await db.syncOutbox.bulkDelete(ids);

    logger.info(`[DatabaseCleanup] Supprimé ${oldItems.length} entrées de queue sync échouées`);
    return oldItems.length;
  } catch (error) {
    logger.error('[DatabaseCleanup] Erreur lors du nettoyage de la queue sync:', error);
    return 0;
  }
}

/**
 * Exécute le nettoyage complet de toutes les tables IA
 */
export async function runDatabaseCleanup(): Promise<{
  aiLogs: number;
  userFeedback: number;
  syncLogs: number;
  syncQueue: number;
  total: number;
}> {
  logger.info('[DatabaseCleanup] Début du nettoyage de la base de données');

  const [aiLogs, userFeedback, syncLogs, syncQueue] = await Promise.all([
    cleanupAILearningLogs(),
    cleanupUserFeedback(),
    cleanupSyncLogs(),
    cleanupSyncQueue(),
  ]);

  const total = aiLogs + userFeedback + syncLogs + syncQueue;

  logger.info(`[DatabaseCleanup] Nettoyage terminé: ${total} entrées supprimées`);

  return {
    aiLogs,
    userFeedback,
    syncLogs,
    syncQueue,
    total,
  };
}

/**
 * Planifie le nettoyage automatique (exécuté quotidiennement)
 */
let cleanupInterval: number | null = null;

export function scheduleDatabaseCleanup(intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = window.setInterval(() => {
    runDatabaseCleanup().catch(error => {
      logger.error('[DatabaseCleanup] Erreur lors du nettoyage planifié:', error);
    });
  }, intervalMs);

  logger.info('[DatabaseCleanup] Nettoyage automatique planifié toutes les 24h');
}

export function stopDatabaseCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[DatabaseCleanup] Nettoyage automatique arrêté');
  }
}

export const databaseCleanupService = {
  run: runDatabaseCleanup,
  schedule: scheduleDatabaseCleanup,
  stop: stopDatabaseCleanup,
  config: CLEANUP_CONFIG,
};

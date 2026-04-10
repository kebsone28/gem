import { PrismaClient } from '@prisma/client';
import { missionNotificationService } from './notification.service.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

const ROLE_MAP = {
    1: 'CHEF_PROJET',
    2: 'COMPTABLE',
    3: 'DIRECTEUR'
};

/**
 * CRON JOB : RAPPELS DE VALIDATION DES MISSIONS
 * Se lance périodiquement pour relancer les valideurs inactifs
 */
export const runMissionReminders = async () => {
    logger.info('🕒 [CRON] Analyse des missions en attente de validation...');
    
    try {
        // 1. Trouver les missions en attente depuis plus de 48h (ou 24h pour plus d'urgence)
        const delayHours = 24;
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - delayHours);

        const pendingWorkflows = await prisma.missionApprovalWorkflow.findMany({
            where: {
                overallStatus: 'pending',
                updatedAt: { lte: cutoffDate }
            },
            include: {
                mission: true
            }
        });

        logger.info(`🔍 [CRON] ${pendingWorkflows.length} mission(s) en attente identifiée(s).`);

        for (const wf of pendingWorkflows) {
            const nextRole = ROLE_MAP[wf.currentStep];
            if (!nextRole) continue;

            logger.info(`📧 [CRON] Envoi rappel à ${nextRole} pour la mission: ${wf.mission.title}`);

            // Utiliser le service de notification existant pour envoyer le mail
            await missionNotificationService.notifyNextStep(wf.mission, nextRole, wf.mission.organizationId);

            // Optionnel: Marquer le workflow comme "relancé" pour éviter de spammer chaque heure
            // si besoin d'un flag plus complexe. Pour l'instant, on laisse ainsi.
        }
    } catch (error) {
        logger.error('❌ [CRON] Erreur lors du rappel des missions:', error);
    }
};

/**
 * Planifier l'exécution toutes les 12 heures
 */
export const startMissionCron = () => {
    const HOURS_INTERVAL = 12;
    const missionInterval = setInterval(runMissionReminders, HOURS_INTERVAL * 60 * 60 * 1000);
    logger.info(`🚀 [CRON] Système de rappel automatique activé (intervalle: ${HOURS_INTERVAL}h).`);

    // Return cleanup function
    return () => {
        logger.info('🛑 [CRON] Arrêt du système de rappel automatique...');
        if (missionInterval) {
            clearInterval(missionInterval);
        }
    };
};

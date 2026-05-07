import { createWorker } from '../../core/utils/queueManager.js';
import { calculerScenario } from './simulation.service.js';
import { socketService } from '../../services/socket.service.js';

/**
 * Worker BullMQ pour les Simulations - PROQUELEC Phase 2
 */

export const initSimulationWorker = () => {
  const worker = createWorker('simulation-queue', async (job) => {
    const { params, userId } = job.data;
    console.log(`[WORKER] Début simulation pour Job ID: ${job.id} (User: ${userId})`);

    try {
      const result = calculerScenario(params);

      // Notification via Socket.io si l'utilisateur est connecté
      socketService.emitToUser(userId, 'SIMULATION_COMPLETE', {
        jobId: job.id,
        result,
      });

      console.log(`[WORKER] Job ${job.id} terminé avec succès.`);
      return result;
    } catch (error) {
      console.error(`[WORKER ERROR] Échec du job ${job.id} :`, error);

      socketService.emitToUser(userId, 'SIMULATION_ERROR', {
        jobId: job.id,
        error: 'Erreur lors du calcul de la simulation.',
      });

      throw error;
    }
  });

  if (!worker) {
    console.warn('[WORKER] Redis non disponible, Simulation Worker est désactivé.');
    return () => {}; // Return empty cleanup function
  }

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job?.id} a échoué : ${err.message}`);
    // Notification finale à l'utilisateur quand toutes les tentatives sont épuisées
    if (job?.data?.userId) {
      socketService.emitToUser(job.data.userId, 'SIMULATION_ERROR', {
        jobId: job?.id,
        error: 'La simulation a échoué après plusieurs tentatives.',
      });
    }
  });

  console.log('[WORKER] Simulation Worker initialisé et prêt.');

  // Return cleanup function
  return async () => {
    console.log('[WORKER] Arrêt du Simulation Worker...');
    try {
      await worker.close();
    } catch (e) {
      console.error('❌ Error closing simulation worker:', e.message);
    }
  };
};

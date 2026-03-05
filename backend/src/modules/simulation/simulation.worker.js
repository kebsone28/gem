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
            // Simulation du délai de calcul pour démonstration de l'asynchronisme
            // (Dans un cas réel, c'est le calcul lui-même qui prend du temps)
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = calculerScenario(params);

            // Notification via Socket.io si l'utilisateur est connecté
            socketService.emitToUser(userId, 'SIMULATION_COMPLETE', {
                jobId: job.id,
                result
            });

            console.log(`[WORKER] Job ${job.id} terminé avec succès.`);
            return result;
        } catch (error) {
            console.error(`[WORKER ERROR] Échec du job ${job.id} :`, error);

            socketService.emitToUser(userId, 'SIMULATION_ERROR', {
                jobId: job.id,
                error: 'Erreur lors du calcul de la simulation.'
            });

            throw error;
        }
    });

    worker.on('failed', (job, err) => {
        console.error(`[WORKER] Job ${job?.id} a échoué : ${err.message}`);
    });

    console.log('[WORKER] Simulation Worker initialisé et prêt.');
};

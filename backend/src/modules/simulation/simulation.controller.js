import { createQueue } from '../../core/utils/queueManager.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const simulationQueue = createQueue('simulation-queue');

/**
 * Soumettre une nouvelle simulation à la file d'attente
 * @route POST /api/simulation/lancer
 */
export const lancerSimulation = async (req, res) => {
    try {
        const { params } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        // On ajoute le job à la queue Redis
        const job = await simulationQueue.add('calcul-simulation', {
            params,
            userId,
            organizationId
        }, {
            removeOnComplete: true,
            attempts: 3
        });

        res.json({
            message: 'Simulation ajoutée à la file d\'attente',
            jobId: job.id
        });
    } catch (error) {
        console.error('Lancer simulation error:', error);
        res.status(500).json({ error: 'Erreur lors du lancement de la simulation' });
    }
};

/**
 * Récupérer l'état d'un job de simulation
 * @route GET /api/simulation/status/:jobId
 */
export const getSimulationStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await simulationQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job non trouvé' });
        }

        const state = await job.getState();
        const result = job.returnvalue;

        res.json({
            jobId,
            state,
            progress: job.progress,
            result
        });
    } catch (error) {
        console.error('Get simulation status error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
    }
};

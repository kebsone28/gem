import express from 'express';
import { lancerSimulation, getSimulationStatus } from '../../modules/simulation/simulation.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

// Seuls ceux qui peuvent voir les finances ou modifier la carte peuvent simuler
router.post('/lancer', verifierPermission(PERMISSIONS.VOIR_FINANCES), lancerSimulation);
router.get('/status/:jobId', verifierPermission(PERMISSIONS.VOIR_FINANCES), getSimulationStatus);

export default router;

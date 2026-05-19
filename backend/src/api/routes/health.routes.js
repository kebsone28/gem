import express from 'express';
import {
  getHealthCenters,
  getHealthCenterById,
  createHealthCenter,
  getCampaigns,
  getCampaignById,
  createCampaign
} from '../../modules/health/health.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierModule } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Protéger toutes les routes
router.use(authProtect);

// Vérifier que le module 'health' est actif pour cette organisation
router.use(verifierModule('health'));

// Récupérer la liste des centres de santé
router.get('/centers', getHealthCenters);

// Récupérer un centre de santé spécifique
router.get('/centers/:id', getHealthCenterById);

// Créer un nouveau centre de santé (nécessite la permission de modifier)
router.post('/centers', verifierPermission(PERMISSIONS.MODIFIER_CARTE), createHealthCenter);

// Récupérer la liste des campagnes
router.get('/campaigns', getCampaigns);

// Récupérer une campagne spécifique
router.get('/campaigns/:id', getCampaignById);

// Créer une nouvelle campagne (nécessite la permission de modifier)
router.post('/campaigns', verifierPermission(PERMISSIONS.MODIFIER_CARTE), createCampaign);

export default router;

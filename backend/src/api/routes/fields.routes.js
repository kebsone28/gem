import express from 'express';
import {
  getFields,
  getFieldById,
  createField,
  getFieldAnalytics
} from '../../modules/agriculture/fields.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierModule } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Protéger toutes les routes
router.use(authProtect);

// Vérifier que le module 'agriculture' est actif pour cette organisation
router.use(verifierModule('agriculture'));

// Récupérer la liste des parcelles
router.get('/', getFields);

// Récupérer une parcelle spécifique
router.get('/:id', getFieldById);

// Créer une nouvelle parcelle (nécessite la permission de créer/modifier)
router.post('/', verifierPermission(PERMISSIONS.MODIFIER_CARTE), createField);

// Calculs d'intelligence agronomique (Yield, Water, Rotation)
router.get('/:id/analytics', getFieldAnalytics);

export default router;

import express from 'express';
import {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  getShipments,
  getShipmentById,
  createShipment
} from '../../modules/logistics/logistics.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierModule } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Protéger toutes les routes
router.use(authProtect);

// Vérifier que le module 'logistics' est actif pour cette organisation
router.use(verifierModule('logistics'));

// Récupérer la liste des entrepôts
router.get('/warehouses', getWarehouses);

// Récupérer un entrepôt spécifique
router.get('/warehouses/:id', getWarehouseById);

// Créer un nouvel entrepôt (nécessite la permission de modifier)
router.post('/warehouses', verifierPermission(PERMISSIONS.MODIFIER_CARTE), createWarehouse);

// Récupérer la liste des expéditions/livraisons
router.get('/shipments', getShipments);

// Récupérer une expédition/livraison spécifique
router.get('/shipments/:id', getShipmentById);

// Créer une nouvelle expédition (nécessite la permission de modifier)
router.post('/shipments', verifierPermission(PERMISSIONS.MODIFIER_CARTE), createShipment);

export default router;

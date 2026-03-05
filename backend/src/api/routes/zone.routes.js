import express from 'express';
import {
    getZones,
    createZone,
    deleteZone
} from '../../modules/zone/zone.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

router.get('/', getZones);
router.post('/', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('zone'), createZone);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_PROJET), verifierAssignation('zone'), deleteZone);

export default router;

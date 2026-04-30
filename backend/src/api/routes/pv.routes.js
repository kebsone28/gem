import express from 'express';
import {
    clearPVs,
    deletePV,
    listPVs,
    resetHouseholdPVs,
    upsertPV
} from '../../modules/pv/pv.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

router.get('/', verifierPermission(PERMISSIONS.VOIR_RAPPORTS), listPVs);
router.post('/', verifierPermission(PERMISSIONS.GERER_PV), upsertPV);
router.delete('/clear', verifierPermission(PERMISSIONS.GERER_PV), clearPVs);
router.delete('/household/:householdId', verifierPermission(PERMISSIONS.GERER_PV), resetHouseholdPVs);
router.delete('/:id', verifierPermission(PERMISSIONS.GERER_PV), deletePV);

export default router;

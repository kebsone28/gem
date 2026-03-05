import express from 'express';
import {
    getHouseholds,
    getHouseholdById,
    createHousehold,
    updateHousehold
} from '../../modules/household/household.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

router.get('/', getHouseholds);
router.get('/:id', getHouseholdById);
router.post('/', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), createHousehold);
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), updateHousehold);

export default router;

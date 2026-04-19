import express from 'express';
import {
    getHouseholds,
    getHouseholdById,
    getHouseholdByNumero,
    createHousehold,
    updateHousehold,
    getHouseholdsCount,
    getHouseholdApprovalHistory,
    approveHouseholdStep,
    rejectHouseholdStep
} from '../../modules/household/household.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// DEBUG: Temporary route to test without auth
router.get('/debug/list', async (req, res) => {
    try {
        const { default: prisma } = await import('../../core/utils/prisma.js');
        const households = await prisma.household.findMany({
            select: { id: true, name: true, location: true, numeroordre: true, status: true }
        });
        res.json({ count: households.length, households });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.use(authProtect);

router.get('/', getHouseholds);
router.get('/count', getHouseholdsCount);
router.get('/by-numero/:numeroordre', getHouseholdByNumero);
router.get('/:id', getHouseholdById);
router.post('/', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), createHousehold);
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), updateHousehold);
// Workflow d'approbation
router.get('/:householdId/approval-history', getHouseholdApprovalHistory);
router.post('/:householdId/approve', approveHouseholdStep);
router.post('/:householdId/reject', rejectHouseholdStep);

export default router;

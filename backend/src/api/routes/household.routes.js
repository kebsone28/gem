import express from 'express';
import eventBus from '../../core/utils/eventBus.js';
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

// Server-Sent Events stream for households updates
router.get('/stream', authProtect, (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });

    // small helper to send SSE
    const sendEvent = (event, payload) => {
        try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (e) {
            // ignore write errors
        }
    };

    const upsertHandler = (payload) => sendEvent('household:upsert', payload);
    const deleteHandler = (payload) => sendEvent('household:delete', payload);

    eventBus.on('household:upsert', upsertHandler);
    eventBus.on('household:delete', deleteHandler);

    // keep-alive comment every 20s
    const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (e) {}
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        eventBus.removeListener('household:upsert', upsertHandler);
        eventBus.removeListener('household:delete', deleteHandler);
    });
});

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

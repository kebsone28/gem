import express from 'express';
import eventBus from '../../core/utils/eventBus.js';
import {
    getHouseholds,
    getHouseholdById,
    getHouseholdByNumero,
    createHousehold,
    updateHousehold,
    deleteHousehold,
    getHouseholdsCount,
    getHouseholdApprovalHistory,
    approveHouseholdStep,
    rejectHouseholdStep,
    exportHouseholds
} from '../../modules/household/household.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierAssignation, verifierModule } from '../../middleware/verifierPermission.js';
import { validateSchema } from '../../middleware/validation.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { getValidHouseholdStatuses } from '../../core/config/businessRules.js';
import { domainContext } from '../../middleware/domainContext.js';

const router = express.Router();

const VALID_HOUSEHOLD_STATUSES = getValidHouseholdStatuses();

const householdCreateSchema = {
  fields: {
    name: { type: 'string', maxLength: 255 },
    phone: { type: 'string', maxLength: 20 },
    status: { type: 'string', enum: VALID_HOUSEHOLD_STATUSES },
    region: { type: 'string', maxLength: 100 },
    departement: { type: 'string', maxLength: 100 },
    village: { type: 'string', maxLength: 100 },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
  },
};

const householdUpdateSchema = {
  fields: {
    name: { type: 'string', maxLength: 255 },
    phone: { type: 'string', maxLength: 20 },
    status: { type: 'string', enum: VALID_HOUSEHOLD_STATUSES },
    region: { type: 'string', maxLength: 100 },
    departement: { type: 'string', maxLength: 100 },
    village: { type: 'string', maxLength: 100 },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
  },
};

const householdApproveSchema = {
  required: ['status'],
  fields: {
    status: { type: 'string', required: true, enum: ['approved', 'rejected'] },
    comments: { type: 'string', maxLength: 2000 },
  },
};

router.use(authProtect);
router.use(verifierModule('terrain'));
router.use(domainContext);

// Server-Sent Events stream for households updates — [FIX m-2] authProtect déjà actif via router.use()
router.get('/stream', (req, res) => {
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
        try { res.write(': ping\n\n'); } catch { /* SSE keep-alive — ignore */ }
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        eventBus.removeListener('household:upsert', upsertHandler);
        eventBus.removeListener('household:delete', deleteHandler);
    });
});

router.get('/', getHouseholds);
router.get('/count', getHouseholdsCount);
router.get('/export', verifierPermission(PERMISSIONS.HOUSEHOLD_EXPORT), exportHouseholds);
router.get('/by-numero/:numeroordre', getHouseholdByNumero);
router.get('/:id', getHouseholdById);
router.post('/', validateSchema(householdCreateSchema), verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), createHousehold);
router.patch('/:id', validateSchema(householdUpdateSchema), verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), updateHousehold);
// [FIX C-3] Suppression (soft-delete) d'un ménage
router.delete('/:id', verifierPermission(PERMISSIONS.MODIFIER_CARTE), verifierAssignation('menage'), deleteHousehold);
// Workflow d'approbation
router.get('/:householdId/approval-history', getHouseholdApprovalHistory);
router.post('/:householdId/approve', validateSchema(householdApproveSchema), approveHouseholdStep);
router.post('/:householdId/reject', validateSchema(householdApproveSchema), rejectHouseholdStep);

export default router;

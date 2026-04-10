import express from 'express';
import path from 'path';
import {
    getMissions,
    getPendingApprovals,
    createMission,
    updateMission,
    deleteMission,
    getMissionApprovalHistory,
    approveMissionStep,
    rejectMissionStep,
    duplicateMission,
    overrideOrderNumber
} from '../../modules/mission/mission.controller.js';
import { authProtect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Add a simple debug middleware to trace all incoming requests
router.use((req, res, next) => {
    import('fs').then(fs => fs.appendFileSync(path.join(__dirname, '../../debug-mission.log'), `INCOMING: ${req.method} ${req.originalUrl}\n`));
    next();
});

// All routes require authentication
router.use(authProtect);

// Approval specific (must be before :id routes)
router.get('/approvals/pending', authorize('ADMIN_PROQUELEC', 'ADMIN', 'DG_PROQUELEC', 'DG', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), getPendingApprovals);

// CRUD
router.get('/', getMissions);

// CRUD
router.get('/', getMissions);

// WRAPPER DE DEBUG POUR INTERCEPTER LE 500 EXACT
router.post('/', authorize('ADMIN_PROQUELEC', 'ADMIN', 'DG_PROQUELEC', 'DG', 'CHEF_PROJET', 'DIRECTEUR', 'COMPTABLE'), async (req, res, next) => {
    try {
        await createMission(req, res);
    } catch (e) {
        import('fs').then(fs => fs.appendFileSync(path.join(__dirname, '../../debug-mission.log'), 'ROUTER CATCH: ' + e.stack + '\n'));
        next(e);
    }
});
router.patch('/:id', authorize('ADMIN_PROQUELEC', 'ADMIN', 'DG_PROQUELEC', 'CHEF_PROJET', 'DIRECTEUR', 'COMPTABLE'), updateMission);
router.put('/:id', authorize('ADMIN_PROQUELEC', 'ADMIN', 'DG_PROQUELEC', 'CHEF_PROJET', 'DIRECTEUR', 'COMPTABLE'), updateMission);
router.delete('/:id', authorize('ADMIN_PROQUELEC', 'ADMIN'), deleteMission);
router.post('/:id/duplicate', authorize('ADMIN_PROQUELEC', 'ADMIN', 'DG_PROQUELEC', 'DG', 'CHEF_PROJET', 'DIRECTEUR'), duplicateMission);

// Mission approval endpoints
router.get('/:missionId/approval-history', getMissionApprovalHistory);
router.post('/:missionId/approve', authorize('ADMIN_PROQUELEC', 'DG_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), approveMissionStep);
router.post('/:missionId/reject', authorize('ADMIN_PROQUELEC', 'DG_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), rejectMissionStep);
router.post('/:missionId/override-order-number', authorize('ADMIN_PROQUELEC'), overrideOrderNumber);

export default router;

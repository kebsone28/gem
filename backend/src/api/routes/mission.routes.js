import express from 'express';
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

// All routes require authentication
router.use(authProtect);

// =============================================
// RÔLES CANONIQUES (après normalisation dans authorize()) :
//   ADMIN_PROQUELEC = Super Admin (bypass total)
//   DIRECTEUR       = Directeur Général (approuve tout, voit soumises)
//   CHEF_PROJET     = Chef de Projet (voit ses missions seulement)
//   COMPTABLE       = Comptable (voit soumises)
// =============================================

// Cockpit d'approbation - tous ceux qui participent au workflow
router.get('/approvals/pending', authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), getPendingApprovals);

// CRUD missions
router.get('/', getMissions); // Filtrage géré dans le contrôleur selon le rôle

router.post('/', authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), async (req, res, next) => {
    try {
        await createMission(req, res);
    } catch (e) {
        next(e);
    }
});

router.patch('/:id', authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), updateMission);
router.put('/:id',   authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), updateMission);
router.delete('/:id', authorize('ADMIN_PROQUELEC'), deleteMission);
router.post('/:id/duplicate', authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET'), duplicateMission);

// Workflow d'approbation
router.get('/:missionId/approval-history', getMissionApprovalHistory);
router.post('/:missionId/approve', authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), approveMissionStep);
router.post('/:missionId/reject',  authorize('ADMIN_PROQUELEC', 'DIRECTEUR', 'CHEF_PROJET', 'COMPTABLE'), rejectMissionStep);
router.post('/:missionId/override-order-number', authorize('ADMIN_PROQUELEC'), overrideOrderNumber);

export default router;

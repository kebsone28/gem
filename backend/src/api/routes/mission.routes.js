import express from 'express';
import {
    getMissions,
    getMissionStats,
    getPendingApprovals,
    createMission,
    updateMission,
    deleteMission,
    getMissionApprovalHistory,
    approveMissionStep,
    rejectMissionStep,
    duplicateMission,
    overrideOrderNumber,
    verifyMissionPublic,
    downloadMissionCertifiedDocumentPublic,
    downloadMissionCertifiedDocument,
    sendMissionDocumentEmail,
    analyzeMissionIA,
    purgeMissions
} from '../../modules/mission/mission.controller.js';
import { authProtect, authorize } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import multer from 'multer';

// Internal multer for doc sending
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Public route - MUST BE BEFORE authProtect
router.get('/verify/:identifier', verifyMissionPublic);
router.get('/verify/:identifier/document', downloadMissionCertifiedDocumentPublic);

// Secure routes - require authentication
router.use(authProtect);

// =============================================
// RÔLES CANONIQUES (après normalisation dans authorize()) :
//   ADMIN_PROQUELEC = Super Admin (bypass total)
//   DIRECTEUR       = Directeur Général (approuve tout, voit soumises)
//   CHEF_PROJET     = Chef de Projet (voit ses missions seulement)
//   COMPTABLE       = Comptable (voit soumises)
// =============================================

// Cockpit d'approbation - validation finale par Direction ou Administration
router.get('/approvals/pending', authorize('ADMIN_PROQUELEC', 'DIRECTEUR'), getPendingApprovals);

// CRUD missions
router.get('/', getMissions); // Filtrage géré dans le contrôleur selon le rôle
router.get('/stats', getMissionStats); // Statistiques KPI
router.delete('/purge/all', authorize('ADMIN_PROQUELEC'), purgeMissions); // Purge massive (Admin seulement)

router.post('/', verifierPermission(PERMISSIONS.CREER_MISSION), async (req, res, next) => {
    try {
        await createMission(req, res);
    } catch (e) {
        next(e);
    }
});
router.patch('/:id', verifierPermission(PERMISSIONS.MODIFIER_MISSIONS), updateMission);
router.put('/:id',   verifierPermission(PERMISSIONS.MODIFIER_MISSIONS), updateMission);
router.delete('/:id', verifierPermission(PERMISSIONS.SUPPRIMER_MISSIONS), deleteMission);
router.post('/:id/duplicate', verifierPermission(PERMISSIONS.CREER_MISSION), duplicateMission);

// Workflow d'approbation - validation finale par Direction ou Administration
router.get('/:missionId/approval-history', getMissionApprovalHistory);
router.post('/:missionId/approve', authorize('ADMIN_PROQUELEC', 'DIRECTEUR'), approveMissionStep);
router.post('/:missionId/reject',  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'), rejectMissionStep);
router.post('/:missionId/override-order-number', authorize('ADMIN_PROQUELEC'), overrideOrderNumber);
router.get('/:missionId/certified-document', downloadMissionCertifiedDocument);
router.post('/:missionId/send-document-email', upload.single('document'), sendMissionDocumentEmail);
router.post('/:missionId/analyze-ia', authorize('ADMIN_PROQUELEC', 'DIRECTEUR'), analyzeMissionIA);

export default router;

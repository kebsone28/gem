import express from 'express';
import rateLimit from 'express-rate-limit';
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
  purgeMissions,
  assignMissionToProject,
} from '../../modules/mission/mission.controller.js';
import { authProtect, authorize } from '../middlewares/auth.js';
import { verifierPermission, verifierModule } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { validate } from '../../middleware/validate.js';
import { getAllValidMissionStatuses } from '../../core/config/businessRules.js';
import multer from 'multer';
import Joi from 'joi';
import {
  getMissionsSchema,
  getMissionStatsSchema,
  missionCreateSchema,
  missionUpdateSchema,
  missionAssignSchema,
  duplicateMissionSchema,
  overrideOrderNumberSchema,
  approveMissionStepSchema,
  rejectMissionStepSchema,
  downloadMissionCertifiedDocumentSchema,
  sendMissionDocumentEmailSchema,
  analyzeMissionIaSchema,
  verifyMissionPublicSchema,
  downloadMissionCertifiedDocumentPublicSchema,
  purgeMissionsSchema,
} from '../../modules/mission/mission.validation.schemas.js';

// Internal multer for doc sending
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Rate limiters
const missionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.', code: 'MISSION_RATE_LIMIT' },
  skip: () => process.env.NODE_ENV === 'development',
});

const missionWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de modifications. Réessayez dans une minute.',
    code: 'MISSION_WRITE_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

const missionApproveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de validations. Réessayez dans une minute.',
    code: 'MISSION_APPROVE_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

// Public route - MUST BE BEFORE authProtect
router.get('/verify/:identifier', validate(verifyMissionPublicSchema), verifyMissionPublic);
router.get(
  '/verify/:identifier/document',
  validate(downloadMissionCertifiedDocumentPublicSchema),
  downloadMissionCertifiedDocumentPublic
);

// Secure routes - require authentication
router.use(authProtect);
router.use(verifierModule('mission'));
router.use(missionLimiter);

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
router.get('/', validate(getMissionsSchema), getMissions); // Filtrage géré dans le contrôleur selon le rôle
router.get('/stats', validate(getMissionStatsSchema), getMissionStats); // Statistiques KPI
router.delete(
  '/purge/all',
  authorize('ADMIN_PROQUELEC'),
  validate(purgeMissionsSchema),
  purgeMissions
); // Purge massive (Admin seulement)

// Define mission schemas (Joi)
const MISSION_STATUS_ENUM = getAllValidMissionStatuses();

router.post(
  '/',
  missionWriteLimiter,
  validate(missionCreateSchema),
  verifierPermission(PERMISSIONS.CREER_MISSION),
  async (req, res, next) => {
    try {
      await createMission(req, res);
    } catch (e) {
      next(e);
    }
  }
);
router.patch(
  '/:id',
  missionWriteLimiter,
  validate(missionUpdateSchema),
  verifierPermission(PERMISSIONS.MODIFIER_MISSIONS),
  updateMission
);
router.patch(
  '/:id/assign-project',
  missionWriteLimiter,
  validate(missionAssignSchema),
  verifierPermission(PERMISSIONS.MODIFIER_MISSIONS),
  assignMissionToProject
);
router.put(
  '/:id',
  missionWriteLimiter,
  validate(missionUpdateSchema),
  verifierPermission(PERMISSIONS.MODIFIER_MISSIONS),
  updateMission
);
router.delete(
  '/:id',
  missionWriteLimiter,
  verifierPermission(PERMISSIONS.SUPPRIMER_MISSIONS),
  deleteMission
);
router.post(
  '/:id/duplicate',
  missionWriteLimiter,
  validate(duplicateMissionSchema),
  verifierPermission(PERMISSIONS.CREER_MISSION),
  duplicateMission
);

// Workflow d'approbation - validation finale par Direction ou Administration
router.get(
  '/:missionId/approval-history',
  validate({ params: { missionId: Joi.string().uuid().required() } }),
  getMissionApprovalHistory
);
router.post(
  '/:missionId/approve',
  missionApproveLimiter,
  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'),
  validate(approveMissionStepSchema),
  approveMissionStep
);
router.post(
  '/:missionId/reject',
  missionApproveLimiter,
  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'),
  validate(rejectMissionStepSchema),
  rejectMissionStep
);
router.post(
  '/:missionId/override-order-number',
  authorize('ADMIN_PROQUELEC'),
  validate(overrideOrderNumberSchema),
  overrideOrderNumber
);
router.get(
  '/:missionId/certified-document',
  validate(downloadMissionCertifiedDocumentSchema),
  downloadMissionCertifiedDocument
);
router.post(
  '/:missionId/send-document-email',
  upload.single('document'),
  validate(sendMissionDocumentEmailSchema),
  sendMissionDocumentEmail
);
router.post(
  '/:missionId/analyze-ia',
  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'),
  validate(analyzeMissionIaSchema),
  analyzeMissionIA
);

export default router;

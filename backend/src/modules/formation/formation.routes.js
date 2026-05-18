/**
 * Formation Routes - API de gestion des formations
 */
import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { validateSchema } from '../../api/middleware/validation.js';
import formationController from './formation.controller.js';

const router = Router();

// Formation schemas for validation
const formationModuleSchema = {
  required: ['title'],
  fields: {
    title: { type: 'string', required: true, minLength: 3, maxLength: 255 },
    description: { type: 'string', maxLength: 5000 },
    duration: { type: 'number', minimum: 0 },
  },
};

const formationSessionSchema = {
  required: ['title', 'startDate', 'endDate'],
  fields: {
    title: { type: 'string', required: true, minLength: 3, maxLength: 255 },
    description: { type: 'string', maxLength: 5000 },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string', required: true },
    location: { type: 'string', maxLength: 500 },
    maxParticipants: { type: 'number', minimum: 1 },
  },
};

const formationParticipantSchema = {
  required: ['userId'],
  fields: {
    userId: { type: 'string', required: true },
  },
};

// Protection globale : toutes les routes formation nécessitent une authentification
router.use(authProtect);

// Routes modules
router.get('/modules', formationController.getModules);
router.post('/modules', validateSchema(formationModuleSchema), formationController.createModule);
router.put('/modules/:id', validateSchema(formationModuleSchema), formationController.updateModule);
router.delete('/modules/:id', formationController.deleteModule);

// Routes sessions
router.get('/sessions', formationController.getSessions);
router.post('/sessions', validateSchema(formationSessionSchema), formationController.createSession);
router.put('/sessions/:id', validateSchema(formationSessionSchema), formationController.updateSession);
router.delete('/sessions/:id', formationController.deleteSession);
router.post('/sessions/:id/recalculate-cascade', formationController.cascadeRescheduleSession);

// Routes modules d'une session
router.post('/sessions/:id/modules', formationController.addModuleToSession);
router.delete(
  '/sessions/:sessionId/modules/:moduleId',
  formationController.removeModuleFromSession
);

// Routes participants
router.post('/sessions/:id/participants', validateSchema(formationParticipantSchema), formationController.addParticipant);
router.delete('/participants/:id', formationController.removeParticipant);
router.put('/participants/:id/attendance', formationController.toggleAttendance);

// Routes utilitaires
router.get('/regions', formationController.getRegions);
router.post('/planify', formationController.planify);
router.post('/planify/validate-preview-session', formationController.validatePreviewSessionEdit);
router.post('/planify/export', formationController.exportPlanify);
router.post('/planify/commit', formationController.commitPlanify);
router.get('/planning', formationController.getPlanning);
router.post('/bulk', formationController.bulkCreateSessions);
router.get('/stats', formationController.getStats);
router.get('/planner-state', formationController.getPlannerState);
router.put('/planner-state', formationController.savePlannerState);
router.get('/history', formationController.getHistory);
router.post('/history', formationController.createHistoryEntry);
router.delete('/history', formationController.clearHistory);

export default router;

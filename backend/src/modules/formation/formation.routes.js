/**
 * Formation Routes - API de gestion des formations
 */
import { Router } from 'express';
import formationController from './formation.controller.js';

const router = Router();

// Routes modules
router.get('/modules', formationController.getModules);
router.post('/modules', formationController.createModule);

// Routes sessions
router.get('/sessions', formationController.getSessions);
router.post('/sessions', formationController.createSession);
router.put('/sessions/:id', formationController.updateSession);
router.delete('/sessions/:id', formationController.deleteSession);

// Routes participants
router.post('/sessions/:id/participants', formationController.addParticipant);
router.delete('/participants/:id', formationController.removeParticipant);
router.put('/participants/:id/attendance', formationController.toggleAttendance);

// Routes utilitaires
router.get('/regions', formationController.getRegions);
router.get('/planning', formationController.getPlanning);
router.post('/bulk', formationController.bulkCreateSessions);
router.get('/stats', formationController.getStats);

export default router;
/**
 * Approval Router
 * Routes pour les endpoints d'approbation
 */

import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
  executeAction,
  getPendingApprovals,
  approveAction,
  rejectAction,
  getApprovalHistory,
  getApprovalStats
} from './approval.controller.js';

const router = Router();

// Protéger tous les endpoints
router.use(authProtect);

/**
 * POST /approvals/execute
 * Exécute une action avec approbation intelligente
 */
router.post('/execute', executeAction);

/**
 * GET /approvals/pending
 * Récupère les approbations en attente
 */
router.get('/pending', getPendingApprovals);

/**
 * POST /approvals/:approvalId/approve
 * Approuve une action
 */
router.post('/:approvalId/approve', approveAction);

/**
 * POST /approvals/:approvalId/reject
 * Rejette une action
 */
router.post('/:approvalId/reject', rejectAction);

/**
 * GET /approvals/history
 * Récupère l'historique des approbations
 */
router.get('/history', getApprovalHistory);

/**
 * GET /approvals/stats
 * Récupère les statistiques
 */
router.get('/stats', getApprovalStats);

export default router;

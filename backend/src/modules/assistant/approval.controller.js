/**
 * Approval Controller
 * Endpoints pour gérer les approbations d'actions AI
 */

import logger from '../../utils/logger.js';
import { approvalService } from './services/ApprovalService.js';
import { approvalExecutor } from './services/ApprovalExecutor.js';

/**
 * POST /approvals/execute
 * Exécute une action avec approbation intelligente
 */
export const executeAction = async (req, res) => {
  try {
    const { agentName, actionType, confidence = 0.5, payload, metadata = {} } = req.body;
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!agentName || !actionType || !payload) {
      return res.status(400).json({
        error: 'agentName, actionType, and payload are required'
      });
    }

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    const result = await approvalExecutor.executeWithApproval({
      organizationId,
      userId: user.id,
      agentName,
      actionType,
      confidence: Math.min(1, Math.max(0, confidence)),
      payload,
      requestedBy: user.email || 'api',
      metadata
    });

    logger.info('Action execution initiated', {
      actionType,
      agentName,
      userId: user.id,
      status: result.status
    });

    return res.json(result);
  } catch (error) {
    logger.error('Action execution failed', {
      error: error.message,
      body: req.body
    });
    return res.status(500).json({
      error: 'Failed to execute action',
      details: error.message
    });
  }
};

/**
 * GET /approvals/pending
 * Récupère les approbations en attente
 */
export const getPendingApprovals = async (req, res) => {
  try {
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Vérifier les permissions admin
    if (user.role !== 'ADMIN' && user.role !== 'ADMIN_PROQUELEC') {
      return res.status(403).json({
        error: 'Only admins can view pending approvals'
      });
    }

    const filters = {
      agentName: req.query.agentName || null,
      riskLevel: req.query.riskLevel || null,
      actionType: req.query.actionType || null
    };

    // Nettoyer les filtres null
    Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

    const approvals = await approvalService.getPendingApprovals(organizationId, filters);

    logger.info('Pending approvals fetched', {
      count: approvals.length,
      organizationId,
      userId: user.id
    });

    return res.json({
      count: approvals.length,
      items: approvals
    });
  } catch (error) {
    logger.error('Failed to fetch pending approvals', {
      error: error.message,
      organizationId: req.user?.organizationId
    });
    return res.status(500).json({
      error: 'Failed to fetch pending approvals',
      details: error.message
    });
  }
};

/**
 * POST /approvals/:approvalId/approve
 * Approuve une action en attente
 */
export const approveAction = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!approvalId) {
      return res.status(400).json({ error: 'approvalId is required' });
    }

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Vérifier les permissions
    if (user.role !== 'ADMIN' && user.role !== 'ADMIN_PROQUELEC') {
      return res.status(403).json({
        error: 'Only admins can approve actions'
      });
    }

    // Valider que l'approbation appartient à l'org
    const prisma = (await import('../../../core/utils/prisma.js')).default;
    const approval = await prisma.actionApproval.findUnique({
      where: { id: approvalId }
    });

    if (!approval || approval.organizationId !== organizationId) {
      return res.status(404).json({
        error: 'Approval not found or access denied'
      });
    }

    const result = await approvalService.approveAction(
      approvalId,
      user.id
    );

    logger.info('Action approved', {
      approvalId,
      approvedBy: user.id,
      actionType: approval.actionType
    });

    return res.json({
      status: 'APPROVED',
      approval: result.approval || result
    });
  } catch (error) {
    logger.error('Failed to approve action', {
      error: error.message,
      approvalId: req.params.approvalId
    });
    return res.status(500).json({
      error: 'Failed to approve action',
      details: error.message
    });
  }
};

/**
 * POST /approvals/:approvalId/reject
 * Rejette une action en attente
 */
export const rejectAction = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { comment = '' } = req.body;
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!approvalId) {
      return res.status(400).json({ error: 'approvalId is required' });
    }

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Vérifier les permissions
    if (user.role !== 'ADMIN' && user.role !== 'ADMIN_PROQUELEC') {
      return res.status(403).json({
        error: 'Only admins can reject actions'
      });
    }

    // Valider que l'approbation appartient à l'org
    const prisma = (await import('../../../core/utils/prisma.js')).default;
    const approval = await prisma.actionApproval.findUnique({
      where: { id: approvalId }
    });

    if (!approval || approval.organizationId !== organizationId) {
      return res.status(404).json({
        error: 'Approval not found or access denied'
      });
    }

    const result = await approvalService.rejectAction(
      approvalId,
      user.id,
      comment
    );

    logger.info('Action rejected', {
      approvalId,
      rejectedBy: user.id,
      actionType: approval.actionType,
      comment
    });

    return res.json({
      status: 'REJECTED',
      approval: result
    });
  } catch (error) {
    logger.error('Failed to reject action', {
      error: error.message,
      approvalId: req.params.approvalId
    });
    return res.status(500).json({
      error: 'Failed to reject action',
      details: error.message
    });
  }
};

/**
 * GET /approvals/history
 * Récupère l'historique des approbations
 */
export const getApprovalHistory = async (req, res) => {
  try {
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Vérifier les permissions
    if (user.role !== 'ADMIN' && user.role !== 'ADMIN_PROQUELEC') {
      return res.status(403).json({
        error: 'Only admins can view approval history'
      });
    }

    const filters = {
      status: req.query.status || null,
      userId: req.query.userId || null,
      agentName: req.query.agentName || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    // Nettoyer les filtres null
    Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

    const pagination = {
      skip: parseInt(req.query.skip) || 0,
      take: Math.min(parseInt(req.query.take) || 50, 100)
    };

    const history = await approvalService.getApprovalHistory(
      organizationId,
      filters,
      pagination
    );

    logger.info('Approval history fetched', {
      count: history.items.length,
      organizationId,
      userId: user.id
    });

    return res.json(history);
  } catch (error) {
    logger.error('Failed to fetch approval history', {
      error: error.message,
      organizationId: req.user?.organizationId
    });
    return res.status(500).json({
      error: 'Failed to fetch approval history',
      details: error.message
    });
  }
};

/**
 * GET /approvals/stats
 * Récupère les statistiques des approbations
 */
export const getApprovalStats = async (req, res) => {
  try {
    const user = req.user || {};
    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Vérifier les permissions
    if (user.role !== 'ADMIN' && user.role !== 'ADMIN_PROQUELEC') {
      return res.status(403).json({
        error: 'Only admins can view approval stats'
      });
    }

    const stats = await approvalService.getApprovalStats(organizationId);

    logger.info('Approval stats fetched', {
      organizationId,
      userId: user.id
    });

    return res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch approval stats', {
      error: error.message,
      organizationId: req.user?.organizationId
    });
    return res.status(500).json({
      error: 'Failed to fetch approval stats',
      details: error.message
    });
  }
};

/**
 * ApprovalService
 * Gère l'orchestration des approbations et l'exécution sécurisée des actions
 */

import prisma from '../../../core/utils/prisma.js';
import logger from '../../../utils/logger.js';
import {
  getActionConfig,
  canAgentExecuteAction,
  determineExecutionFlow,
  approvalSettings,
  confidenceThresholds
} from './actionConfig.js';

export class ApprovalService {
  /**
   * Sauvegarde une action en attente d'approbation
   */
  async createApprovalRecord(actionData) {
    const {
      organizationId,
      userId,
      agentName,
      actionType,
      confidence = 0.5,
      payload,
      requestedBy,
      metadata = {}
    } = actionData;

    // Vérifier les permissions
    if (!canAgentExecuteAction(agentName, actionType)) {
      throw new Error(`Agent ${agentName} cannot execute action ${actionType}`);
    }

    const actionConfig = getActionConfig(actionType);
    const executionFlow = determineExecutionFlow(actionConfig.risk, confidence);

    const approvalData = {
      organizationId,
      userId,
      agentName,
      actionType,
      riskLevel: actionConfig.risk,
      confidence,
      payload,
      status: executionFlow === 'AUTO_EXECUTE' || executionFlow === 'AUTO_EXECUTE_LOGGED'
        ? 'AUTO_EXECUTED'
        : 'PENDING',
      requestedBy,
      metadata: {
        ...metadata,
        executionFlow,
        actionConfig: {
          description: actionConfig.description,
          requiresApproval: actionConfig.requiresApproval
        }
      }
    };

    try {
      const approval = await prisma.actionApproval.create({
        data: approvalData
      });

      logger.info('ActionApproval created', {
        approvalId: approval.id,
        status: approval.status,
        actionType: approval.actionType,
        flow: executionFlow
      });

      return approval;
    } catch (err) {
      logger.error('Failed to create ActionApproval', {
        error: err.message,
        actionType
      });
      throw err;
    }
  }

  /**
   * Récupère les approbations en attente
   */
  async getPendingApprovals(organizationId, filters = {}) {
    try {
      const where = {
        organizationId,
        status: 'PENDING'
      };

      if (filters.agentName) where.agentName = filters.agentName;
      if (filters.riskLevel) where.riskLevel = filters.riskLevel;
      if (filters.actionType) where.actionType = filters.actionType;

      return await prisma.actionApproval.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
    } catch (err) {
      logger.error('Failed to fetch pending approvals', { error: err.message });
      throw err;
    }
  }

  /**
   * Approuve une action et l'exécute
   */
  async approveAction(approvalId, approvedBy, executeFn = null) {
    try {
      const approval = await prisma.actionApproval.findUnique({
        where: { id: approvalId }
      });

      if (!approval) {
        throw new Error(`ActionApproval ${approvalId} not found`);
      }

      if (approval.status !== 'PENDING') {
        throw new Error(`Cannot approve: status is ${approval.status}, not PENDING`);
      }

      // Mettre à jour le statut
      const updated = await prisma.actionApproval.update({
        where: { id: approvalId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date()
        }
      });

      logger.info('ActionApproval approved', {
        approvalId,
        approvedBy,
        actionType: approval.actionType
      });

      // Exécuter l'action si une fonction est fournie
      if (executeFn && typeof executeFn === 'function') {
        try {
          const result = await executeFn(approval.payload, approval.metadata);
          
          await prisma.actionApproval.update({
            where: { id: approvalId },
            data: {
              status: 'EXECUTED',
              executedAt: new Date(),
              result: result
            }
          });

          logger.info('ActionApproval executed successfully', {
            approvalId,
            actionType: approval.actionType
          });

          return { status: 'EXECUTED', result };
        } catch (execErr) {
          await prisma.actionApproval.update({
            where: { id: approvalId },
            data: {
              status: 'FAILED',
              error: execErr.message,
              executedAt: new Date()
            }
          });

          logger.error('ActionApproval execution failed', {
            approvalId,
            error: execErr.message
          });

          throw execErr;
        }
      }

      return { status: 'APPROVED', approval: updated };
    } catch (err) {
      logger.error('Failed to approve action', { error: err.message });
      throw err;
    }
  }

  /**
   * Rejette une action
   */
  async rejectAction(approvalId, rejectedBy, rejectionComment = '') {
    try {
      const approval = await prisma.actionApproval.findUnique({
        where: { id: approvalId }
      });

      if (!approval) {
        throw new Error(`ActionApproval ${approvalId} not found`);
      }

      if (approval.status !== 'PENDING') {
        throw new Error(`Cannot reject: status is ${approval.status}, not PENDING`);
      }

      const updated = await prisma.actionApproval.update({
        where: { id: approvalId },
        data: {
          status: 'REJECTED',
          rejectedBy,
          rejectedAt: new Date(),
          rejectionComment
        }
      });

      logger.info('ActionApproval rejected', {
        approvalId,
        rejectedBy,
        actionType: approval.actionType,
        comment: rejectionComment
      });

      return updated;
    } catch (err) {
      logger.error('Failed to reject action', { error: err.message });
      throw err;
    }
  }

  /**
   * Exécute une action directement (AUTO_EXECUTED)
   */
  async executeActionDirect(actionData, executeFn) {
    try {
      const approval = await this.createApprovalRecord(actionData);

      if (approval.status === 'AUTO_EXECUTED') {
        const result = await executeFn(approval.payload, approval.metadata);
        
        await prisma.actionApproval.update({
          where: { id: approval.id },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            result
          }
        });

        logger.info('Action auto-executed', {
          approvalId: approval.id,
          actionType: approval.actionType
        });

        return { status: 'EXECUTED', approvalId: approval.id, result };
      }

      return { status: 'PENDING', approvalId: approval.id };
    } catch (err) {
      logger.error('Failed to execute action directly', { error: err.message });
      throw err;
    }
  }

  /**
   * Obtient l'historique des approbations
   */
  async getApprovalHistory(organizationId, filters = {}, pagination = {}) {
    try {
      const { skip = 0, take = 50 } = pagination;
      const where = { organizationId };

      if (filters.status) where.status = filters.status;
      if (filters.userId) where.userId = filters.userId;
      if (filters.agentName) where.agentName = filters.agentName;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }

      const [items, total] = await Promise.all([
        prisma.actionApproval.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, email: true, name: true } }
          }
        }),
        prisma.actionApproval.count({ where })
      ]);

      return {
        items,
        pagination: {
          skip,
          take,
          total,
          pages: Math.ceil(total / take)
        }
      };
    } catch (err) {
      logger.error('Failed to fetch approval history', { error: err.message });
      throw err;
    }
  }

  /**
   * Obtient les statistiques des approbations
   */
  async getApprovalStats(organizationId) {
    try {
      const stats = await prisma.actionApproval.groupBy({
        by: ['status', 'riskLevel'],
        where: { organizationId },
        _count: true
      });

      const totalByStatus = await prisma.actionApproval.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
        _avg: { confidence: true }
      });

      return {
        byStatusAndRisk: stats,
        byStatus: totalByStatus
      };
    } catch (err) {
      logger.error('Failed to get approval stats', { error: err.message });
      throw err;
    }
  }
}

export const approvalService = new ApprovalService();

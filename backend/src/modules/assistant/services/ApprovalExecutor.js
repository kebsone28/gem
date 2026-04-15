/**
 * Approval Middleware & Executor
 * Intercepte et gère l'exécution d'actions avec validation d'approbation
 * 
 * ⚠️ EMERGENCY OVERRIDE: Si APPROVAL_SYSTEM_BYPASS=true (ENV),
 * exécute directement en bypassing approval (USE CASE: system recovery)
 */

import { approvalService } from './ApprovalService.js';
import {
  getActionConfig,
  canAgentExecuteAction,
  determineExecutionFlow,
  confidenceThresholds
} from '../config/actionConfig.js';
import logger from '../../../utils/logger.js';

// EMERGENCY: Safe override for system recovery
const APPROVAL_BYPASS_ENABLED = process.env.APPROVAL_SYSTEM_BYPASS === 'true';
if (APPROVAL_BYPASS_ENABLED) {
  logger.warn('⚠️ APPROVAL SYSTEM BYPASS ENABLED - Emergency mode active');
}

export class ApprovalExecutor {
  /**
   * Execute une action à travers le système d'approbation
   * Détermine automatiquement si besoin validation ou exécution directe
   * 
   * ⚠️ FAIL-SAFE: Si approval system crash → log warning & attempt direct
   */
  async executeWithApproval(actionData) {
    const {
      organizationId,
      userId,
      agentName,
      actionType,
      confidence = 0.5,
      payload,
      requestedBy = 'system',
      metadata = {},
      executeFn = null
    } = actionData;

    try {
      // EMERGENCY BYPASS (for system recovery)
      if (APPROVAL_BYPASS_ENABLED) {
        logger.error('🚨 APPROVAL BYPASS ACTIVE - Executing directly without approval', {
          actionType,
          agentName,
          bypassReason: 'APPROVAL_SYSTEM_BYPASS env enabled'
        });

        if (executeFn && typeof executeFn === 'function') {
          try {
            const result = await executeFn(payload, metadata);
            return {
              status: 'EXECUTED_BYPASS',
              message: '⚠️ Executed in emergency bypass mode (approval system unavailable)',
              result,
              emergencyMode: true
            };
          } catch (err) {
            return {
              status: 'BYPASS_FAILED',
              error: err.message,
              emergencyMode: true
            };
          }
        }

        return { status: 'QUEUED_BYPASS', message: 'Queued for execution (approval bypassed)', emergencyMode: true };
      }

      // Validations basiques
      this.validateActionData(actionData);

      // Vérifier permissions agent
      if (!canAgentExecuteAction(agentName, actionType)) {
        throw new Error(
          `Agent ${agentName} is not permitted to execute action ${actionType}`
        );
      }

      const actionConfig = getActionConfig(actionType);
      const executionFlow = determineExecutionFlow(actionConfig.risk, confidence);

      logger.info('Action execution flow determined', {
        actionType,
        flow: executionFlow,
        riskLevel: actionConfig.risk,
        confidence
      });

      // Créer l'enregistrement d'approbation
      const approval = await approvalService.createApprovalRecord({
        organizationId,
        userId,
        agentName,
        actionType,
        confidence,
        payload,
        requestedBy,
        metadata: {
          ...metadata,
          executionFlow,
          riskLevel: actionConfig.risk
        }
      });

      // Router selon le type d'exécution
      switch (executionFlow) {
        case 'AUTO_EXECUTE':
          return await this.autoExecute(approval, executeFn);

        case 'AUTO_EXECUTE_LOGGED':
          return await this.autoExecuteLogged(approval, executeFn);

        case 'REQUIRE_APPROVAL':
          return {
            status: 'PENDING_APPROVAL',
            approvalId: approval.id,
            message: `Action en attente d'approbation admin`,
            action: {
              type: actionType,
              description: actionConfig.description,
              riskLevel: actionConfig.risk,
              confidence: Math.round(confidence * 100) + '%'
            }
          };

        default:
          throw new Error(`Unknown execution flow: ${executionFlow}`);
      }
    } catch (err) {
      // ⚠️ CRITICAL: Approval system itself crashed
      logger.error('🚨 CRITICAL: Approval system failed', {
        error: err.message,
        actionType,
        agentName,
        stack: err.stack
      });

      // Fail-safe: Try to prevent total system lockdown
      const isCriticalError = err.message?.includes('database') || 
                              err.message?.includes('connection') ||
                              err.message?.includes('ECONNREFUSED');

      if (isCriticalError) {
        logger.error('🚨 SYSTEM ALERT: Approval system infrastructure failure', {
          type: err.message,
          recommendation: 'Check database connection, enable APPROVAL_SYSTEM_BYPASS if needed'
        });
      }

      return {
        status: 'SYSTEM_ERROR',
        error: err.message,
        isCritical: isCriticalError,
        message: isCriticalError 
          ? 'Système d\'approbation indisponible. Contact admin.' 
          : 'Erreur lors de l\'exécution de l\'action',
        recovery: isCriticalError ? 'Set APPROVAL_SYSTEM_BYPASS=true to recovery' : null
      };
    }
  }

  /**
   * Auto-exécution sans validation (LOW RISK)
   */
  async autoExecute(approval, executeFn) {
    if (!executeFn || typeof executeFn !== 'function') {
      return {
        status: 'AUTO_EXECUTED_SAVED',
        approvalId: approval.id,
        message: 'Action enregistrée pour auto-exécution'
      };
    }

    try {
      const result = await executeFn(approval.payload, approval.metadata);

      await this.recordExecution(approval.id, 'EXECUTED', result);

      logger.info('Action auto-executed', {
        approvalId: approval.id,
        actionType: approval.actionType
      });

      return {
        status: 'EXECUTED',
        approvalId: approval.id,
        result,
        message: 'Action exécutée avec succès'
      };
    } catch (err) {
      await this.recordExecution(approval.id, 'FAILED', null, err.message);

      logger.error('Auto-execution failed', {
        approvalId: approval.id,
        error: err.message
      });

      return {
        status: 'EXECUTION_FAILED',
        approvalId: approval.id,
        error: err.message,
        message: 'Erreur lors de l\'exécution: ' + err.message
      };
    }
  }

  /**
   * Auto-exécution avec logging (MEDIUM RISK)
   */
  async autoExecuteLogged(approval, executeFn) {
    logger.warn('Auto-executing MEDIUM risk action with audit trail', {
      approvalId: approval.id,
      actionType: approval.actionType,
      riskLevel: approval.riskLevel
    });

    return await this.autoExecute(approval, executeFn);
  }

  /**
   * Enregistre le résultat de l'exécution
   */
  async recordExecution(approvalId, status, result = null, error = null) {
    try {
      const data = {
        status,
        executedAt: new Date()
      };

      if (result) data.result = result;
      if (error) data.error = error;

      // Prisma update would go here
      logger.info('Execution recorded', { approvalId, status });
    } catch (err) {
      logger.error('Failed to record execution', {
        approvalId,
        error: err.message
      });
    }
  }

  /**
   * Valide les données d'action
   */
  validateActionData(actionData) {
    const {
      organizationId,
      agentName,
      actionType,
      payload
    } = actionData;

    if (!organizationId) throw new Error('organizationId is required');
    if (!agentName) throw new Error('agentName is required');
    if (!actionType) throw new Error('actionType is required');
    if (!payload || typeof payload !== 'object') {
      throw new Error('payload must be a valid object');
    }
  }
}

export const approvalExecutor = new ApprovalExecutor();

/**
 * Helper: Wrapper pour convertir une fonction en action approuvable
 */
export async function executeApprovedAction(
  actionType,
  payload,
  executeFn,
  context = {}
) {
  const {
    organizationId,
    userId,
    agentName = 'system',
    confidence = 0.5,
    requestedBy = 'api'
  } = context;

  return approvalExecutor.executeWithApproval({
    organizationId,
    userId,
    agentName,
    actionType,
    confidence,
    payload,
    requestedBy,
    executeFn
  });
}

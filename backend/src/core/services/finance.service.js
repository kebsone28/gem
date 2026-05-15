import prisma from '../utils/prisma.js';
import { eventBus } from './eventBus.service.js';
import logger from '../../utils/logger.js';

class FinanceService {
  /**
   * Enregistre une charge financière universelle
   */
  async recordCharge(params) {
    const {
      projectId,
      organizationId,
      category,
      description,
      amount,
      quantity = 1,
      unitPrice,
      resourceType,
      resourceId,
      metadata = {}
    } = params;

    try {
      const charge = await prisma.financialCharge.create({
        data: {
          projectId,
          organizationId,
          category,
          description,
          amount,
          quantity,
          unitPrice,
          resourceType,
          resourceId,
          metadata
        }
      });

      // Émettre un événement pour mise à jour des KPIs en temps réel
      await eventBus.publish('FINANCE_CHARGE_CREATED', {
        projectId,
        organizationId,
        resource: 'FinancialCharge',
        resourceId: charge.id,
        data: { category, amount, description }
      });

      return charge;
    } catch (error) {
      logger.error('[FINANCE_SERVICE] Failed to record charge', error);
      throw error;
    }
  }

  /**
   * Récupère le récapitulatif financier d'un projet (Toutes catégories confondues)
   */
  async getProjectSummary(projectId) {
    const charges = await prisma.financialCharge.findMany({
      where: { projectId }
    });

    const summary = charges.reduce((acc, charge) => {
      const cat = charge.category;
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Number(charge.amount);
      acc.total += Number(charge.amount);
      return acc;
    }, { total: 0 });

    return summary;
  }

  /**
   * Valide ou modifie le statut d'une transaction
   */
  async updateChargeStatus(chargeId, status, userId) {
    return await prisma.financialCharge.update({
      where: { id: chargeId },
      data: { 
        status,
        metadata: {
          lastStatusUpdateBy: userId,
          lastStatusUpdateAt: new Date()
        }
      }
    });
  }
}

export const financeService = new FinanceService();

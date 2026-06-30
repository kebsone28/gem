import prisma from '../utils/prisma.js';
import { eventBus } from './eventBus.service.js';
import { securityService } from './security.service.js';

class WorkflowService {
  /**
   * Récupère le workflow actif pour une entité donnée dans un module
   */
  async getWorkflow(projectId, entityType, moduleKey) {
    return await prisma.workflow.findFirst({
      where: {
        projectId,
        entityType,
        projectModule: moduleKey ? { key: moduleKey } : undefined,
        active: true
      },
      include: {
        states: { orderBy: { order: 'asc' } },
        transitions: true
      }
    });
  }

  /**
   * Exécute une transition d'état pour une ressource
   */
  async triggerTransition(params) {
    const {
      projectId,
      organizationId,
      userId,
      resource,
      resourceId,
      actionKey,
      currentStatus
    } = params;

    // 1. Trouver le workflow et la transition valide
    const workflow = await this.getWorkflow(projectId, resource.toUpperCase());
    if (!workflow) throw new Error(`Aucun workflow défini pour ${resource}`);

    const transition = workflow.transitions.find(t =>
      t.actionKey === actionKey &&
      workflow.states.find(s => s.id === t.fromStateId)?.key === currentStatus
    );

    if (!transition) {
      throw new Error(`Transition '${actionKey}' non autorisée depuis l'état '${currentStatus}'`);
    }

    // 2. VÉRIFICATION DE LA GOUVERNANCE (PHASE 3.5 SECURITY ENGINE)
    const security = await securityService.evaluate({
      userId,
      organizationId,
      action: actionKey,
      resource: resource.toUpperCase(),
      resourceData: { projectId, ...params.resourceData },
      context: { workflow_state: currentStatus }
    });

    if (!security.allowed) {
      throw new Error(`Gouvernance : ${security.reason}`);
    }

    const targetState = workflow.states.find(s => s.id === transition.toStateId);

    // 3. Émettre l'événement de transition (Audit + Async logic)
    await eventBus.publish('WORKFLOW_TRANSITION', {
      projectId,
      organizationId,
      userId,
      resource,
      resourceId,
      data: {
        from: currentStatus,
        to: targetState.key,
        action: actionKey,
        transitionId: transition.id
      }
    });

    return targetState;
  }

  /**
   * Initialise un workflow par défaut pour un secteur
   * @param {string} projectId - ID du projet
   * @param {string} sector - Secteur du projet
   * @param {string} organizationId - ID de l'organisation
   * @param {string} governanceMode - Mode de gouvernance (enterprise, gov, ong, bailleur)
   * @param {object} tx - Transaction Prisma (optionnel)
   */
  async seedDefaultWorkflow(projectId, sector, organizationId, governanceMode = 'enterprise', tx = null) {
    const db = tx || prisma;

    // États de base communs à tous les modes
    const baseStates = [
      { key: 'DRAFT', label: 'Brouillon', isInitial: true, order: 0, color: '#94a3b8' },
      { key: 'PENDING', label: 'En attente', order: 1, color: '#f59e0b' },
      { key: 'APPROVED', label: 'Approuvé', order: 2, color: '#10b981' },
      { key: 'REJECTED', label: 'Rejeté', isFinal: true, order: 3, color: '#ef4444' }
    ];

    // États et transitions spécifiques selon le mode de gouvernance
    let additionalStates = [];
    let additionalTransitions = [];

    switch (governanceMode) {
      case 'gov':
        // Mode Gouvernement : Double validation et audit
        additionalStates = [
          { key: 'MINISTERIAL_REVIEW', label: 'Révision Ministérielle', order: 2, color: '#8b5cf6' },
          { key: 'FINAL_APPROVAL', label: 'Validation Finale', order: 3, color: '#10b981' }
        ];
        additionalTransitions = [
          {
            workflowId: null, // Sera rempli après création
            fromStateKey: 'PENDING',
            toStateKey: 'MINISTERIAL_REVIEW',
            name: 'Transmettre Ministère',
            actionKey: 'TRANSMIT_MINISTRY',
            requiredRole: 'DIRECTEUR'
          },
          {
            workflowId: null,
            fromStateKey: 'MINISTERIAL_REVIEW',
            toStateKey: 'FINAL_APPROVAL',
            name: 'Validation Ministérielle',
            actionKey: 'MINISTERIAL_APPROVE',
            requiredRole: 'ADMIN'
          }
        ];
        break;

      case 'ong':
        // Mode ONG : Validation impact et bénéficiaires
        additionalStates = [
          { key: 'IMPACT_ASSESSMENT', label: 'Évaluation Impact', order: 2, color: '#06b6d4' },
          { key: 'BENEFICIARY_VALIDATION', label: 'Validation Bénéficiaires', order: 3, color: '#f97316' }
        ];
        additionalTransitions = [
          {
            workflowId: null,
            fromStateKey: 'PENDING',
            toStateKey: 'IMPACT_ASSESSMENT',
            name: 'Évaluer Impact',
            actionKey: 'ASSESS_IMPACT',
            requiredRole: 'COORDINATEUR'
          },
          {
            workflowId: null,
            fromStateKey: 'IMPACT_ASSESSMENT',
            toStateKey: 'BENEFICIARY_VALIDATION',
            name: 'Valider Bénéficiaires',
            actionKey: 'VALIDATE_BENEFICIARIES',
            requiredRole: 'COORDINATEUR'
          },
          {
            workflowId: null,
            fromStateKey: 'BENEFICIARY_VALIDATION',
            toStateKey: 'APPROVED',
            name: 'Approuver Projet',
            actionKey: 'APPROVE',
            requiredRole: 'DIRECTEUR'
          }
        ];
        break;

      case 'bailleur':
        // Mode Bailleur : Conformité et reporting
        additionalStates = [
          { key: 'COMPLIANCE_CHECK', label: 'Vérification Conformité', order: 2, color: '#eab308' },
          { key: 'BAILLIER_REVIEW', label: 'Revue Bailleur', order: 3, color: '#a855f7' }
        ];
        additionalTransitions = [
          {
            workflowId: null,
            fromStateKey: 'PENDING',
            toStateKey: 'COMPLIANCE_CHECK',
            name: 'Vérifier Conformité',
            actionKey: 'CHECK_COMPLIANCE',
            requiredRole: 'COMPLIANCE_OFFICER'
          },
          {
            workflowId: null,
            fromStateKey: 'COMPLIANCE_CHECK',
            toStateKey: 'BAILLIER_REVIEW',
            name: 'Transmettre Bailleur',
            actionKey: 'TRANSMIT_BAILLIER',
            requiredRole: 'DIRECTEUR'
          },
          {
            workflowId: null,
            fromStateKey: 'BAILLIER_REVIEW',
            toStateKey: 'APPROVED',
            name: 'Validation Bailleur',
            actionKey: 'BAILLIER_APPROVE',
            requiredRole: 'ADMIN'
          }
        ];
        break;

      case 'enterprise':
      default:
        // Mode Entreprise : Workflow standard
        break;
    }

    // Fusionner tous les états
    const allStates = [...baseStates, ...additionalStates];

    // Créer le workflow
    const wf = await db.workflow.create({
      data: {
        projectId,
        organizationId,
        name: `Workflow Mission - ${sector} (${governanceMode})`,
        key: `MISSION_WF_${projectId}_${governanceMode}`,
        entityType: 'MISSION',
        states: {
          create: allStates
        }
      },
      include: { states: true }
    });

    // Créer les transitions de base
    const states = wf.states;
    const baseTransitions = [
      {
        workflowId: wf.id,
        fromStateId: states.find(s => s.key === 'DRAFT').id,
        toStateId: states.find(s => s.key === 'PENDING').id,
        name: 'Soumettre',
        actionKey: 'SUBMIT'
      },
      {
        workflowId: wf.id,
        fromStateId: states.find(s => s.key === 'PENDING').id,
        toStateId: states.find(s => s.key === 'APPROVED').id,
        name: 'Approuver',
        actionKey: 'APPROVE',
        requiredRole: 'SUPERVISEUR'
      }
    ];

    // Créer les transitions spécifiques au mode
    const modeSpecificTransitions = additionalTransitions.map(t => ({
      workflowId: wf.id,
      fromStateId: states.find(s => s.key === t.fromStateKey).id,
      toStateId: states.find(s => s.key === t.toStateKey).id,
      name: t.name,
      actionKey: t.actionKey,
      requiredRole: t.requiredRole
    }));

    await db.workflowTransition.createMany({
      data: [...baseTransitions, ...modeSpecificTransitions]
    });

    return wf;
  }
}

export const workflowService = new WorkflowService();

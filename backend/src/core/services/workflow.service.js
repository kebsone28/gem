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
   */
  async seedDefaultWorkflow(projectId, sector, organizationId, tx = null) {
    const db = tx || prisma;
    
    // Exemple : Workflow de Mission standard
    const wf = await db.workflow.create({
      data: {
        projectId,
        organizationId,
        name: `Workflow Mission - ${sector}`,
        key: `MISSION_WF_${projectId}`,
        entityType: 'MISSION',
        states: {
          create: [
            { key: 'DRAFT', label: 'Brouillon', isInitial: true, order: 0, color: '#94a3b8' },
            { key: 'PENDING', label: 'En attente', order: 1, color: '#f59e0b' },
            { key: 'APPROVED', label: 'Approuvé', order: 2, color: '#10b981' },
            { key: 'REJECTED', label: 'Rejeté', isFinal: true, order: 3, color: '#ef4444' }
          ]
        }
      },
      include: { states: true }
    });

    // Créer les transitions de base
    const states = wf.states;
    await db.workflowTransition.createMany({
      data: [
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
      ]
    });

    return wf;
  }
}

export const workflowService = new WorkflowService();

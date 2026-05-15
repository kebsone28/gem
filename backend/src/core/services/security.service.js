import prisma from '../utils/prisma.js';
import logger from '../../utils/logger.js';

class SecurityService {
  /**
   * Évalue si un utilisateur a le droit d'effectuer une action sur une ressource
   * @param {Object} params { userId, organizationId, action, resource, resourceData, context }
   */
  async evaluate(params) {
    const { userId, organizationId, action, resource, resourceData, context = {} } = params;

    // 1. Récupérer l'utilisateur avec son rôle
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) return { allowed: false, reason: 'Utilisateur non trouvé' };

    // 🏆 BYPASS : Super Admin de l'organisation (optionnel, selon gouvernance)
    if (user.role?.key === 'ADMIN') return { allowed: true, scope: 'ORGANIZATION' };

    // 2. Récupérer les politiques actives pour cette action/ressource
    const policies = await prisma.policy.findMany({
      where: {
        organizationId,
        action,
        resource,
        active: true
      }
    });

    // Si aucune politique n'est définie, on refuse par défaut (Security by Default)
    if (policies.length === 0) {
      return { allowed: false, reason: 'Aucune politique de sécurité définie pour cette action' };
    }

    // 3. Évaluation ABAC (Attribute-Based Access Control)
    for (const policy of policies) {
      const isMatch = this.checkConditions(policy.conditions, user, resourceData, context);
      
      if (isMatch) {
        if (policy.effect === 'DENY') return { allowed: false, reason: 'Accès explicitement refusé par une politique' };
        
        // Vérifier le Scope (Région, Projet, etc.)
        const scopeResult = this.checkScope(policy.scope, user, resourceData);
        if (scopeResult.allowed) {
          return { allowed: true, policy: policy.name, scope: policy.scope };
        }
      }
    }

    return { allowed: false, reason: 'Aucune politique correspondante ne valide cet accès' };
  }

  /**
   * Vérifie si les conditions JSON de la politique correspondent au contexte
   */
  checkConditions(conditions, user, resourceData, context) {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    // Logique simplifiée d'évaluation de conditions (extensible)
    // Ex: { "region": "user.region" }
    for (const [key, expectedValue] of Object.entries(conditions)) {
      let actualValue = resourceData?.[key] || context?.[key];
      
      // Support des références utilisateur (ex: "user.id")
      if (typeof expectedValue === 'string' && expectedValue.startsWith('user.')) {
        const userAttr = expectedValue.split('.')[1];
        if (actualValue !== user[userAttr]) return false;
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie si l'accès respecte le scope géographique ou hiérarchique
   */
  checkScope(scope, user, resourceData) {
    switch (scope) {
      case 'GLOBAL': return { allowed: true };
      case 'ORGANIZATION': return { allowed: true }; 
      case 'PROJECT': {
        // Sécurité : vérifier si l'attribut existe
        const userProjectId = user.activeProjectId || user.organization?.defaultProjectId;
        return { allowed: resourceData?.projectId === userProjectId };
      }
      case 'REGION': {
        // Sécurité : si l'utilisateur n'a pas de région définie, on refuse le scope régional
        if (!user.region) return { allowed: false };
        return { allowed: resourceData?.region === user.region };
      }
      case 'OWNER':
        return { allowed: resourceData?.createdBy === user.id || resourceData?.userId === user.id };
      default:
        return { allowed: false };
    }
  }

  /**
   * Initialise les politiques par défaut pour un nouveau projet/organisation
   */
  async seedDefaultPolicies(organizationId, tx = null) {
    const db = tx || prisma;

    const defaultPolicies = [
      {
        organizationId,
        name: 'Contrôle Régional Missions',
        description: 'Les agents ne voient que les missions de leur région',
        action: 'MISSION_VIEW',
        resource: 'MISSION',
        scope: 'REGION',
      },
      {
        organizationId,
        name: 'Approbation Hiérarchique',
        description: 'Seuls les superviseurs peuvent approuver dans leur région',
        action: 'MISSION_APPROVE',
        resource: 'MISSION',
        scope: 'REGION',
        conditions: { "workflow_state": "PENDING" }
      }
    ];

    await db.policy.createMany({ data: defaultPolicies });
    logger.info(`[SecurityService] Default policies seeded for organization ${organizationId}`);
  }
}

export const securityService = new SecurityService();

import { PrismaClient } from '@prisma/client';
import { config } from '../config/config.js';
import { getOrganizationId, getUserId, getProjectId } from '../context/storage.js';
import { tracerAction } from '../../services/audit.service.js';

console.log('🔧 Initializing Prisma for DB:', config.dbUrl);

const basePrisma = new PrismaClient();

// Liste des modèles qui ne sont PAS filtrés par organizationId (modèles système)
const EXCLUDED_MODELS = ['Organization', 'SystemLog', 'AuditLog'];

// Liste des modèles filtrés par projectId si présent dans le contexte
const PROJECT_LEVEL_MODELS = ['Zone', 'Team', 'Mission', 'PerformanceLog'];

/**
 * CLIENT PRISMA ÉTENDU - ISOLATION MULTI-TENANTE & AUDIT AUTOMATIQUE
 */
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const orgId = getOrganizationId();
        const userId = getUserId();
        const projId = getProjectId();

        // 1. ISOLATION TENANTE (FILTRAGE)
        if (!EXCLUDED_MODELS.includes(model) && orgId) {
          const filter = { organizationId: orgId };

          // 2. ISOLATION PROJET (Si configurée dans le contexte)
          if (projId) {
             if (PROJECT_LEVEL_MODELS.includes(model)) {
                 filter.projectId = projId;
             } else if (model === 'Household') {
                 // Isolation indirecte : Un ménage doit appartenir à une zone du projet
                 filter.zone = { projectId: projId };
             }
          }

          // Application globale des filtres
          if (['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'count', 'groupBy', 'aggregate'].includes(operation)) {
            args.where = { ...(args.where || {}), ...filter };
          }
          
          if (['create', 'createMany'].includes(operation)) {
            const inject = { ...filter };
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, ...inject }));
            } else {
              args.data = { ...args.data, ...inject };
            }
          }

          if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
            args.where = { ...(args.where || {}), ...filter };
          }
        }

        // Exécution de la requête
        const result = await query(args);

        // 2. AUDIT AUTOMATIQUE
        // On trace toutes les mutations (sauf pour AuditLog lui-même pour éviter une boucle)
        if (['create', 'update', 'delete', 'updateMany', 'deleteMany', 'upsert'].includes(operation) && model !== 'AuditLog') {
          if (orgId && userId) {
            tracerAction({
              userId,
              organizationId: orgId,
              action: `AUTO_${operation.toUpperCase()}_${model.toUpperCase()}`,
              resource: model,
              resourceId: result?.id || (args.where?.id) || null,
              details: { 
                operation,
                // On log les clés modifiées mais pas forcément toutes les valeurs sensibles (RGPD)
                fields: args.data ? Object.keys(args.data) : (args.where ? Object.keys(args.where) : [])
              }
            }).catch(e => console.warn(`[PRISMA_AUDIT] Fail: ${e.message}`));
          }
        }

        return result;
      }
    }
  }
});

export default prisma;

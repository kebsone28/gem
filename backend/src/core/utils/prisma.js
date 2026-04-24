/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config.js';
import { getOrganizationId, getUserId, getProjectId } from '../context/storage.js';

if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Initializing Prisma for DB:', config.dbUrl);
}

export const basePrisma = new PrismaClient();

// Liste des modèles qui ne sont PAS filtrés par organizationId (modèles système)
const EXCLUDED_MODELS = ['Organization', 'SystemLog', 'AuditLog', 'Role', 'Permission', 'RolePermission', 'Region', 'FormationModule', 'FormationSession', 'FormationSessionModule', 'FormationParticipant', 'FormationPlanningHistory', 'FormationPlannerState'];

// Liste des modèles filtrés par projectId si présent dans le contexte
const PROJECT_LEVEL_MODELS = ['Zone', 'Team', 'Mission', 'PerformanceLog', 'Alert'];

/**
 * CLIENT PRISMA ÉTENDU - ISOLATION MULTI-TENANTE & AUDIT AUTOMATIQUE
 * 
 * Security Strategy:
 * - READ operations (findMany, findFirst, count): automatic tenant filtering via organizationId.
 * - WRITE operations (create, createMany): automatic organizationId injection.
 * - BULK WRITE (updateMany, deleteMany): automatic tenant filtering.
 * - SINGLE MUTATIONS (update, delete, upsert): ownership checked in each controller
 *   via an explicit findFirst(where: { id, organizationId }) BEFORE the mutation.
 *   We do NOT do async pre-checks here to avoid AsyncLocalStorage context loss inside
 *   Prisma Client Extensions $allOperations interceptors.
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

          // ISOLATION PROJET (Si configurée dans le contexte)
          // ✅ NOTE: Household est intentionnellement EXCLU du filtrage auto-projet.
          if (projId && PROJECT_LEVEL_MODELS.includes(model)) {
              filter.projectId = projId;
          }

          // Injection automatique sur les lectures multi-résultats
          if (['findMany', 'findFirst', 'count', 'groupBy', 'aggregate'].includes(operation)) {
            args.where = { ...(args.where || {}), ...filter };
          }

          // findUnique -> downgrade vers findFirst pour injecter le filtre tenant
          // (Prisma exige un index unique exact pour findUnique)
          if (['findUnique', 'findUniqueOrThrow'].includes(operation)) {
            const newOp = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
            args.where = { ...(args.where || {}), ...filter };
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            return basePrisma[modelName][newOp](args);
          }
          
          // Injection sur les créations
          if (['create', 'createMany'].includes(operation)) {
            const inject = { ...filter };
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, ...inject }));
            } else {
              args.data = { ...args.data, ...inject };
            }
          }

          // Injection sur les mutations groupées
          if (['updateMany', 'deleteMany'].includes(operation)) {
            args.where = { ...(args.where || {}), ...filter };
          }

          // update / delete / upsert sur un seul enregistrement:
          // La sécurité est garantie par les contrôleurs qui font un findFirst(id, organizationId)
          // avant chaque mutation. On ne fait rien ici pour éviter des await imbriqués
          // qui peuvent corrompre le contexte AsyncLocalStorage.
        }

        // Exécution de la requête
        const result = await query(args);

        // AUDIT AUTOMATIQUE (fire-and-forget)
        if (['create', 'update', 'delete', 'updateMany', 'deleteMany', 'upsert'].includes(operation) && model !== 'AuditLog') {
          if (orgId && userId) {
            basePrisma.auditLog.create({
              data: {
                userId,
                organizationId: orgId,
                action: `AUTO_${operation.toUpperCase()}_${model.toUpperCase()}`,
                resource: model,
                resourceId: result?.id || (args.where?.id) || null,
                details: { 
                  operation,
                  fields: args.data ? Object.keys(args.data) : (args.where ? Object.keys(args.where) : [])
                }
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

/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from '../config/config.js';
import { getOrganizationId, getUserId, getProjectId } from '../context/storage.js';
import { isPrismaSchemaDriftError } from './prismaCompat.js';

if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Initializing Prisma for DB:', config.dbUrl);
}

const pool = new pg.Pool({ connectionString: config.dbUrl });
const adapter = new PrismaPg(pool);
export const basePrisma = new PrismaClient({ adapter });

// Modèles sans colonne organizationId: ne jamais y injecter de filtre tenant.
// Formation junction tables (FormationSessionModule, FormationParticipant) have no direct
// organizationId — they are accessed only via FormationSession (which IS org-scoped).
// Main formation tables now have organizationId and are auto-filtered by the middleware.
const EXCLUDED_MODELS = [
  'Organization',
  'SystemLog',
  'AuditLog',
  'Role',
  'Permission',
  'RolePermission',
  'Region',
  'MissionApprovalWorkflow',
  'MissionApprovalStep',
  'UserMemory',
  'FormationSessionModule', // junction table — no direct org column
  'FormationParticipant', // junction table — no direct org column
  'spatial_ref_sys',
  'WorkflowAction', // if it exists
  'SystemConfig', // Global configuration table
];

// Liste des modèles filtrés par projectId si présent dans le contexte
const PROJECT_LEVEL_MODELS = [
  'Zone',
  'Team',
  'Mission',
  'PerformanceLog',
  'Alert',
  'Household',
  'Workflow',
  'PVRecord',
  'FinancialCharge',
  'Budget',
  'ProjectModule',
  'ProjectPage',
  'WorkflowState',
  'WorkflowTransition',
];

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
            if (!basePrisma[modelName]) {
              console.error(`[PRISMA-CRITICAL] Model ${modelName} not found on basePrisma! model=${model}`);
              throw new Error(`Model ${modelName} not found on Prisma client`);
            }
            return basePrisma[modelName][newOp](args);
          }

          // Injection sur les créations
          if (['create', 'createMany'].includes(operation)) {
            const inject = { ...filter };
            if (Array.isArray(args.data)) {
              args.data = args.data.map((d) => ({ ...d, ...inject }));
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
        let result;
        try {
          result = await query(args);
        } catch (queryError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`[PRISMA-ERROR] Failed op=${operation} on model=${model}:`, queryError.message);
          }
          throw queryError;
        }

        // AUDIT AUTOMATIQUE (fire-and-forget)
        if (
          ['create', 'update', 'delete', 'updateMany', 'deleteMany', 'upsert'].includes(
            operation
          ) &&
          model !== 'AuditLog'
        ) {
          if (orgId && userId) {
            basePrisma.auditLog
              .create({
                data: {
                  userId,
                  organizationId: orgId,
                  action: `AUTO_${operation.toUpperCase()}_${model.toUpperCase()}`,
                  resource: model,
                  resourceId: result?.id || args.where?.id || null,
                  details: {
                    operation,
                    fields: args.data
                      ? Object.keys(args.data)
                      : args.where
                        ? Object.keys(args.where)
                        : [],
                  },
                },
              })
              .catch((e) => {
                if (!isPrismaSchemaDriftError(e)) {
                  console.warn(`[PRISMA_AUDIT] Fail: ${e.message}`);
                }
              });
          }
        }

        return result;
      },
    },
  },
});

export default prisma;

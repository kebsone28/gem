/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config.js';
import { getOrganizationId, getUserId, getProjectId } from '../context/storage.js';

console.log('🔧 Initializing Prisma for DB:', config.dbUrl);

export const basePrisma = new PrismaClient();
const base = basePrisma;

// Liste des modèles qui ne sont PAS filtrés par organizationId (modèles système)
const EXCLUDED_MODELS = ['Organization', 'SystemLog', 'AuditLog'];

// Liste des modèles filtrés par projectId si présent dans le contexte
const PROJECT_LEVEL_MODELS = ['Zone', 'Team', 'Mission', 'PerformanceLog', 'Alert'];

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
          // ✅ NOTE: Household est intentionnellement EXCLU du filtrage auto-projet.
          // Raison: Les ménages doivent être visibles pour tous les projets de l'org
          // dans le pull de sync. Chaque contrôleur (bordereau, terrain) gère son
          // propre filtre de projet via args.where.zone ou args.where.zoneId.
          if (projId && PROJECT_LEVEL_MODELS.includes(model)) {
              filter.projectId = projId;
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
            // Utilisation directe de basePrisma pour éviter la récursion et la dépendance circulaire
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

import { PrismaClient } from '@prisma/client';
import { config } from '../config/config.js';
import { getOrganizationId, getUserId } from '../context/storage.js';
import { tracerAction } from '../../services/audit.service.js';

console.log('🔧 Initializing Prisma for DB:', config.dbUrl);

const basePrisma = new PrismaClient();

// Liste des modèles qui ne sont PAS filtrés par organizationId (modèles système)
const EXCLUDED_MODELS = ['Organization', 'SystemLog', 'AuditLog'];

/**
 * CLIENT PRISMA ÉTENDU - ISOLATION MULTI-TENANTE & AUDIT AUTOMATIQUE
 */
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const orgId = getOrganizationId();
        const userId = getUserId();

        // 1. ISOLATION TENANTE (FILTRAGE)
        // On n'injecte l'orgId que si on ne fait pas partie des modèles système
        if (!EXCLUDED_MODELS.includes(model) && orgId) {
          // Filtrage pour la Lecture
          if (['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'count', 'groupBy', 'aggregate'].includes(operation)) {
            args.where = { ...(args.where || {}), organizationId: orgId };
          }
          // Injection pour la Création
          if (['create', 'createMany'].includes(operation)) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, organizationId: orgId }));
            } else {
              args.data = { ...args.data, organizationId: orgId };
            }
          }
          // Sécurité pour la Modification / Suppression
          if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
            args.where = { ...(args.where || {}), organizationId: orgId };
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

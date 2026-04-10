import prisma from '../core/utils/prisma.js';

/**
 * Service d'Audit - PROQUELEC SaaS
 * Permet de tracer toutes les actions critiques effectuées sur la plateforme.
 */
export const tracerAction = async (dataOrOrgId, userId, action, resource, resourceId, details, req = null) => {
    try {
        let finalData = {};

        // Si le premier argument est un objet (nouveau format)
        if (typeof dataOrOrgId === 'object' && !Array.isArray(dataOrOrgId) && dataOrOrgId !== null) {
            finalData = dataOrOrgId;
        } 
        // Sinon, on reconstruit l'objet à partir des arguments positionnels (ancien format)
        else {
            finalData = {
                organizationId: dataOrOrgId,
                userId,
                action,
                resource,
                resourceId: resourceId || null,
                details: details || {},
                req: req || null
            };
        }

        const { 
            organizationId: orgId, 
            userId: uId, 
            action: act, 
            resource: resrc, 
            resourceId: resId, 
            details: det, 
            req: request 
        } = finalData;

        // Utiliser une exécution asynchrone non-bloquante totale
        prisma.auditLog.create({
            data: {
                userId: uId,
                organizationId: orgId,
                action: act,
                resource: resrc,
                resourceId: resId,
                details: det || {},
                ipAddress: request ? request.ip : null,
                userAgent: request ? request.headers['user-agent'] : null
            }
        }).then(() => {
            console.log(`[AUDIT] Action tracée : ${act} sur ${resrc}`);
        }).catch(err => {
            console.error('[ERREUR AUDIT] Échec silencieux :', err.message);
        });
    } catch (error) {
        // On ne bloque pas l'application si l'audit échoue, mais on log l'erreur
        console.error('[ERREUR AUDIT] Impossible d\'enregistrer le log d\'audit :', error);
    }
};

/**
 * Récupère les dernières actions d'une organisation
 */
export const getRecentActions = async (organizationId, limit = 10) => {
    try {
        return await prisma.auditLog.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: {
                        name: true,
                        role: true,
                        email: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    } catch (error) {
        console.error('[ERREUR AUDIT] Impossible de récupérer les logs :', error);
        return [];
    }
};

export default { tracerAction, getRecentActions };

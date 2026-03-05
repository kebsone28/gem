import prisma from '../core/utils/prisma.js';

/**
 * Service d'Audit - PROQUELEC SaaS
 * Permet de tracer toutes les actions critiques effectuées sur la plateforme.
 */
export const tracerAction = async ({
    userId,
    organizationId,
    action,
    resource,
    resourceId = null,
    details = {},
    req = null
}) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                organizationId,
                action,
                resource,
                resourceId,
                details: details || {},
                ipAddress: req ? req.ip : null,
                userAgent: req ? req.headers['user-agent'] : null
            }
        });

        console.log(`[AUDIT] Action tracée : ${action} sur ${resource} (ID: ${resourceId}) par l'utilisateur ${userId}`);
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

import { basePrisma as prisma } from '../core/utils/prisma.js';
import { sendMail } from './mail.service.js';

/**
 * Service d'Audit - PROQUELEC SaaS
 * Permet de tracer toutes les actions critiques et d'envoyer des notifications email si nécessaire.
 */
export const tracerAction = async (dataOrOrgId, userId, action, resource, resourceId, details, req = null) => {
    try {
        let finalData = {};

        // Si le premier argument est un objet (nouveau format)
        if (typeof dataOrOrgId === 'object' && !Array.isArray(dataOrOrgId) && dataOrOrgId !== null) {
            finalData = dataOrOrgId;
        } 
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

        // 1. Enregistrement en base de données
        const auditData = {
            organizationId: orgId,
            action: act,
            resource: resrc,
            resourceId: resId,
            details: det || {},
            ipAddress: request ? request.ip : null,
            userAgent: request ? request.headers['user-agent'] : null
        };

        // N'ajouter userId que s'il est présent pour éviter les erreurs de relation Prisma
        if (uId) {
            auditData.userId = uId;
        }

        prisma.auditLog.create({
            data: auditData
        })
        .then(() => console.log(`[AUDIT] Action enregistrée en base : ${act}`))
        .catch(err => {
            console.error(`[ERREUR AUDIT DB] Échec pour ${act}:`, err.message);
            // On ne crash pas le process, mais on log l'erreur critique
        });

        // 2. Notification Email pour les actions CRITIQUES
        const criticalActions = ['SUPPRESSION_PROJET', 'MODIFICATION_SECURITE', 'RESET_DATA', 'CREATION_MISSION'];
        if (criticalActions.includes(act) && process.env.AUDIT_NOTIF_EMAILS) {
            const recipient = process.env.AUDIT_NOTIF_EMAILS;
            sendMail({
                to: recipient,
                subject: `Alerte Sécurité: ${act}`,
                title: `Action Critique Détectée`,
                body: `
                    L'action <b>${act}</b> a été effectuée sur la ressource <b>${resrc}</b> (ID: ${resId}).
                    <br/><br/>
                    <b>Détails :</b> ${JSON.stringify(det)}
                    <br/>
                    <b>Utilisateur :</b> ${uId || 'Système'}
                    <br/>
                    <b>Date :</b> ${new Date().toLocaleString()}
                `
            }).catch(err => console.error('[ERREUR NOTIF EMAIL] :', err.message));
        }

        console.log(`[AUDIT] Action tracée : ${act}`);
    } catch (error) {
        console.error('[ERREUR AUDIT] Échec :', error);
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

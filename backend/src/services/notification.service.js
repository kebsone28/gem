import { PrismaClient } from '@prisma/client';
import { sendMail } from './mail.service.js';

const prisma = new PrismaClient();

/**
 * SERVICE DE NOTIFICATION DES MISSIONS
 * Gère l'envoi automatique de mails aux acteurs du workflow
 */
export const missionNotificationService = {
    /**
     * Récupère les emails d'audit depuis la configuration de l'organisation
     */
    async _getAuditEmails(organizationId) {
        try {
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { config: true }
            });
            
            if (org?.config?.notifications?.auditEmails) {
                return org.config.notifications.auditEmails.join(',');
            }
        } catch (error) {
            console.error('❌ Erreur lecture config audit:', error);
        }
        return process.env.AUDIT_NOTIF_EMAILS || '';
    },

    /**
     * Notifie les acteurs de l'étape suivante dans le workflow
     */
    async notifyNextStep(mission, nextRole, organizationId) {
        try {
            const users = await prisma.user.findMany({
                where: {
                    organizationId: organizationId,
                    role: { in: Array.isArray(nextRole) ? nextRole : [nextRole] },
                    active: true
                },
                select: { email: true, notificationEmail: true, name: true }
            });

            if (users.length === 0) return;

            const auditEmails = await this._getAuditEmails(organizationId);
            const recipientList = users.map(u => u.notificationEmail || u.email).join(',');
            const fullRecipients = auditEmails ? `${recipientList},${auditEmails}` : recipientList;

            const body = `Une nouvelle mission (<b>${mission.title || 'Sans titre'}</b>) est en attente de votre validation.<br>
                         Numéro temporaire: ${mission.id.substring(0, 8).toUpperCase()}<br>
                         Type d'action requise: <b>Approbation ${nextRole}</b>`;

            await sendMail({
                to: fullRecipients,
                subject: `Action Requise: Validation de Mission (${nextRole})`,
                title: 'Nouvelle mission reçue',
                body,
                actionLink: `${process.env.FRONTEND_URL}/admin/mission?id=${mission.id}`,
                actionLabel: 'Accéder à la mission'
            });
        } catch (error) {
            console.error('❌ Erreur notification workflow:', error);
        }
    },

    /**
     * Notifie le créateur que la mission est VALIDÉE et numérotée
     */
    async notifyFullApproval(mission, orderNumber, userId) {
        try {
            const initiator = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, notificationEmail: true, organizationId: true, name: true }
            });

            if (!initiator) return;

            // Collect emails of DG, Admin, and Accountant for this organization
            const stakeholders = await prisma.user.findMany({
                where: {
                    organizationId: initiator.organizationId,
                    roleLegacy: { in: ['DG_PROQUELEC', 'ADMIN_PROQUELEC', 'COMPTABLE'] },
                    active: true
                },
                select: { email: true, notificationEmail: true }
            });

            const stakeholderEmails = stakeholders.map(s => s.notificationEmail || s.email);
            const auditEmails = await this._getAuditEmails(initiator.organizationId);
            
            // Final list with Initiator + Stakeholders + Audit
            const recipients = [...new Set([
                initiator.notificationEmail || initiator.email, 
                ...stakeholderEmails, 
                ...(auditEmails ? auditEmails.split(',') : [])
            ])].filter(Boolean).join(',');

            const body = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #16a34a;">✅ Mission Certifiée Officiellement</h2>
                    <p>L'ordre de mission <b>${mission.title}</b> vient d'être certifié par la Direction Générale.</p>
                    
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                        <span style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #166534;">${orderNumber}</span>
                        <br><small style="color: #166534; opacity: 0.7;">NUMÉRO D'ORDRE UNIQUE</small>
                    </div>

                    <table style="width: 100%; border-spacing: 0; margin-bottom: 20px;">
                        <tr><td style="padding: 8px 0; color: #666;">Demandeur:</td><td style="font-weight: bold;">${initiator.name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Budget:</td><td style="font-weight: bold; color: #16a34a;">${mission.budget?.toLocaleString() || '—'} FCFA</td></tr>
                    </table>

                    <p>Ce document est désormais exécutoire et opposable.</p>
                </div>
            `;

            await sendMail({
                to: recipients,
                subject: `[CERTIFIÉ] Ordre de Mission : ${orderNumber}`,
                title: 'Mission Validée par la DG',
                body,
                actionLink: `${process.env.FRONTEND_URL}/admin/mission?id=${mission.id}`,
                actionLabel: 'Télécharger l\'Ordre de Mission'
            });
        } catch (error) {
            console.error('❌ Erreur notification succès général:', error);
        }
    },

    /**
     * Notifie le créateur d'un rejet
     */
    async notifyRejection(mission, role, comment, userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, organizationId: true }
            });

            if (!user) return;

            const auditEmails = await this._getAuditEmails(user.organizationId);
            const fullRecipients = auditEmails ? `${user.email},${auditEmails}` : user.email;

            const body = `Votre mission <b>${mission.title}</b> a été rejetée par l'étape <b>${role}</b>.<br><br>
                         <b>Commentaire:</b> <i>"${comment || 'Pas de commentaire spécifié'}"</i><br><br>
                         Veuillez corriger la mission et la soumettre à nouveau.`;

            await sendMail({
                to: fullRecipients,
                subject: `🚨 Mission Rejetée: ${mission.title}`,
                title: 'Correction de mission nécessaire',
                body,
                actionLink: `${process.env.FRONTEND_URL}/admin/mission?id=${mission.id}`,
                actionLabel: 'Modifier la mission'
            });
        } catch (error) {
            console.error('❌ Erreur notification rejet:', error);
        }
    },

    /**
     * 🔔 Notifie le DG qu'une mission a été soumise et attend sa validation
     * Appelé automatiquement quand status → 'soumise'
     */
    async notifySubmission(mission, dgEmail) {
        try {
            const missionData = typeof mission.data === 'object' ? mission.data : {};
            const membersCount = missionData?.members?.length || 0;
            const budget = mission.budget ? `${mission.budget.toLocaleString('fr-FR')} FCFA` : 'Non spécifié';

            const body = `
                <p>Une nouvelle mission est en attente de votre validation officielle.</p>
                <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:13px;">
                    <tr><td style="padding:8px; color:#64748b; font-weight:bold; width:40%;">Mission</td><td style="padding:8px; font-weight:bold;">${mission.title || 'Sans titre'}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:8px; color:#64748b; font-weight:bold;">Objet</td><td style="padding:8px;">${missionData?.purpose || 'Non spécifié'}</td></tr>
                    <tr><td style="padding:8px; color:#64748b; font-weight:bold;">Budget Prévisionnel</td><td style="padding:8px; color:#16a34a; font-weight:bold;">${budget}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:8px; color:#64748b; font-weight:bold;">Équipe</td><td style="padding:8px;">${membersCount} missionnaire(s)</td></tr>
                    <tr><td style="padding:8px; color:#64748b; font-weight:bold;">Départ</td><td style="padding:8px;">${mission.startDate ? new Date(mission.startDate).toLocaleDateString('fr-FR') : 'N/A'}</td></tr>
                </table>
                <p style="margin-top:16px; color:#64748b; font-size:12px;">Accédez au Cockpit DG pour examiner le dossier complet et apposer votre signature officielle.</p>
            `;

            await sendMail({
                to: dgEmail,
                subject: `📋 Mission à Certifier : ${mission.title || 'Nouvelle mission'}`,
                title: '⏳ Validation Direction Générale Requise',
                body,
                actionLink: `${process.env.FRONTEND_URL}/admin/approbation`,
                actionLabel: 'Ouvrir le Cockpit DG'
            });
        } catch (error) {
            console.error('❌ Erreur notification soumission DG:', error);
        }
    },

    /**
     * 🏅 Notifie l'initiateur que sa mission a été certifiée par le DG
     */
    async notifyDGCertified(mission, orderNumber, initiatorEmail) {
        try {
            const body = `
                <p>Excellente nouvelle ! Votre mission a été <b>officiellement certifiée</b> par la Direction Générale.</p>
                <div style="text-align:center; margin:24px 0;">
                    <div style="display:inline-block; padding:16px 32px; background:#16a34a; color:white; border-radius:12px; font-size:20px; font-weight:900; letter-spacing:2px;">
                        ${orderNumber}
                    </div>
                    <p style="color:#64748b; font-size:12px; margin-top:8px;">Numéro d'Ordre Officiel</p>
                </div>
                <p>Vous pouvez dès à présent imprimer votre ordre de mission et procéder à l'exécution terrain.</p>
            `;

            await sendMail({
                to: initiatorEmail,
                subject: `✅ Mission Certifiée DG : ${orderNumber}`,
                title: '🎉 Ordre de Mission Validé !',
                body,
                actionLink: `${process.env.FRONTEND_URL}/admin/mission?id=${mission.id}`,
                actionLabel: 'Imprimer l\'Ordre de Mission'
            });
        } catch (error) {
            console.error('❌ Erreur notification certification:', error);
        }
    }
};

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * CONFIGURATION DE VOTRE SYSTÈME DE MAIL SERVEUR
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour les autres
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
});

/**
 * Service d'envoi de mail général avec template HTML Proquelec
 */
export const sendMail = async ({ to, subject, title, body, actionLink, actionLabel, attachments }) => {
    try {
        const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 15px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 24px;">GEM SAAS - PROQUELEC</h1>
                <p style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Notification de Mission</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 18px;">${title}</h2>
                <div style="color: #475569; line-height: 1.6; font-size: 14px;">
                    ${body}
                </div>
                
                ${actionLink ? `
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${actionLink}" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                        ${actionLabel || 'Ouvrir la mission'}
                    </a>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center; font-size: 11px; color: #94a3b8;">
                <p>Ceci est un message automatique généré par le système de gestion GEM SAAS.</p>
                <p>&copy; ${new Date().getFullYear()} PROQUELEC - Tous droits réservés.</p>
            </div>
        </div>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"GEM SAAS Notification" <noreply@gem-saas.com>',
            to,
            subject: `[PROQUELEC] ${subject}`,
            html,
            attachments: attachments || []
        });

        console.log(`📧 Mail envoyé à: ${to} (Sujet: ${subject})`);
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du mail:', error);
        return false;
    }
};

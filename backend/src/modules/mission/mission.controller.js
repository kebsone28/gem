import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import logger from '../../utils/logger.js';
import { missionNotificationService } from '../../services/notification.service.js';
import { sendMail } from '../../services/mail.service.js';
import { missionMentorService } from '../assistant/missionMentorService.js';
import { normalizeRole } from '../../core/utils/roles.js';
import QRCode from 'qrcode';
import { buildPublicUrl } from '../../utils/publicUrl.js';

const isDev = process.env.NODE_ENV !== 'production';
const SUBMITTED_MISSION_STATUSES = ['soumise', 'en_attente_validation'];
const FINAL_MISSION_STATUSES = ['approuvee', 'rejetee'];
const REJECTION_CATEGORIES = new Set([
    'DONNEES_INCOMPLETES',
    'BUDGET_INCOHERENT',
    'MISSION_HORS_PERIMETRE',
    'PLANNING_INCOHERENT',
    'JUSTIFICATIFS_MANQUANTS',
    'AUTRE'
]);

const formatDateFr = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

const buildMissionPublicUrl = (identifier) =>
    buildPublicUrl(`/verify/mission/${encodeURIComponent(identifier)}`);

const findMissionLogoPath = () => {
    const candidates = [
        path.resolve(process.cwd(), '../frontend/public/logo-proquelec.png'),
        path.resolve(process.cwd(), '../frontend/dist/logo-proquelec.png'),
        path.resolve(process.cwd(), 'public/logo-proquelec.png'),
    ];
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
};

const drawPdfLogo = (doc, logoPath, x = 42, y = 30, width = 126, height = 48) => {
    if (logoPath) {
        try {
            doc.image(logoPath, x, y, {
                fit: [width, height],
                align: 'left',
                valign: 'center'
            });
            return;
        } catch (error) {
            logger.warn('[MISSION_DOCUMENT] Logo rendering failed', error);
        }
    }

    doc.fillColor('#16324f').font('Helvetica-Bold').fontSize(18).text('PROQUELEC', x, y + 6);
};

const drawPdfSectionTitle = (doc, title, y) => {
    doc
        .fillColor('#16324f')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(title.toUpperCase(), 42, y);
    doc
        .moveTo(42, y + 16)
        .lineTo(552, y + 16)
        .strokeColor('#dbeafe')
        .lineWidth(1)
        .stroke();
    return y + 26;
};

const drawPdfKeyValue = (doc, label, value, x, y, width = 230) => {
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y, {
        width,
        continued: false
    });
    doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(value || '—', x, y + 11, {
        width,
        lineGap: 2
    });
};

const drawPdfFooter = (doc, orderNumber, publicUrl) => {
    const pageHeight = doc.page.height;
    const footerLineY = pageHeight - 78;
    const footerTextY = pageHeight - 68;
    const displayUrl = publicUrl.length > 72 ? `${publicUrl.slice(0, 69)}...` : publicUrl;
    doc
        .moveTo(42, footerLineY)
        .lineTo(552, footerLineY)
        .strokeColor('#e2e8f0')
        .lineWidth(0.6)
        .stroke();
    doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(7)
        .text(`GEM SAAS - PROQUELEC | Ordre de Mission ${orderNumber}`, 42, footerTextY, {
            width: 250,
            lineBreak: false
        });
    doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(6)
        .text(`Verification : ${displayUrl}`, 302, footerTextY, {
            width: 250,
            align: 'right',
            lineBreak: false
        });
};

const drawMissionTable = (doc, rows, startY) => {
    const left = 42;
    const width = 510;
    let y = startY;

    const drawHeader = (label) => {
        doc.rect(left, y, width, 28).fill('#eeeeee').strokeColor('#d9d9d9').stroke();
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(9).text(label, left, y + 10, {
            width,
            align: 'center'
        });
        y += 28;
    };

    const drawRow = (label, value, height = 36) => {
        doc.rect(left, y, 112, height).strokeColor('#d9d9d9').stroke();
        doc.rect(left + 112, y, width - 112, height).strokeColor('#d9d9d9').stroke();
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(9).text(label, left + 14, y + 12, {
            width: 86
        });
        doc.fillColor('#3f3f46').font('Helvetica').fontSize(9).text(`: ${value || '—'}`, left + 126, y + 12, {
            width: width - 144,
            lineGap: 2
        });
        y += height;
    };

    for (const row of rows) {
        if (row.type === 'header') drawHeader(row.label);
        else drawRow(row.label, row.value, row.height);
    }

    return y;
};

const drawMembersHeader = (doc, y) => {
    doc.rect(42, y, 510, 32).fill('#eeeeee');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
    doc.text('N°', 58, y + 12, { width: 40 });
    doc.text('Prenoms et Noms', 128, y + 12, { width: 190 });
    doc.text('Fonction', 340, y + 12, { width: 100 });
    doc.text('Unite', 470, y + 12, { width: 60 });
    return y + 32;
};

const drawApprovalAuditTable = (doc, steps, startY) => {
    let y = startY;
    const left = 42;
    const width = 510;

    doc.rect(left, y, width, 30).fill('#eeeeee').strokeColor('#d9d9d9').stroke();
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
    doc.text('Etape', left + 12, y + 11, { width: 120 });
    doc.text('Statut', left + 142, y + 11, { width: 78 });
    doc.text('Decision', left + 230, y + 11, { width: 82 });
    doc.text('Signature', left + 322, y + 11, { width: 84 });
    doc.text('Commentaire', left + 416, y + 11, { width: 84 });
    y += 30;

    if (!steps.length) {
        doc.rect(left, y, width, 34).strokeColor('#e5e7eb').stroke();
        doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Aucune etape d approbation detaillee disponible.', left + 12, y + 12);
        return y + 44;
    }

    steps.forEach(step => {
        const height = 42;
        doc.rect(left, y, width, height).strokeColor('#e5e7eb').stroke();
        doc.fillColor('#111827').font('Helvetica').fontSize(8);
        doc.text(step.label || step.role || '—', left + 12, y + 10, { width: 120, lineGap: 1 });
        doc.text(step.status || '—', left + 142, y + 10, { width: 78 });
        doc.text(formatDateFr(step.decidedAt), left + 230, y + 10, { width: 82 });
        doc.text(step.signature ? 'Oui' : '—', left + 322, y + 10, { width: 84 });
        doc.text(step.comment || '—', left + 416, y + 10, { width: 84, lineGap: 1 });
        y += height;
    });

    return y + 10;
};

const buildMissionDocumentBuffer = async (mission) => {
    const { default: PDFDocument } = await import('pdfkit');
    const missionData = typeof mission.data === 'object' && mission.data !== null ? mission.data : {};
    const workflow = mission.approvalWorkflow;
    const approvalSteps = Array.isArray(workflow?.approvalSteps) ? workflow.approvalSteps : [];
    const members = Array.isArray(missionData.members) ? missionData.members : [];
    const orderNumber = mission.orderNumber || workflow?.orderNumber || mission.id;
    const publicUrl = buildMissionPublicUrl(orderNumber);
    const logoPath = findMissionLogoPath();
    const qrBuffer = await QRCode.toBuffer(publicUrl, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' }
    });

    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 42,
            info: {
                Title: `Ordre de Mission ${orderNumber}`,
                Author: 'GEM SAAS - PROQUELEC',
            }
        });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        drawPdfLogo(doc, logoPath);

        doc
            .font('Helvetica-Bold')
            .fontSize(15)
            .fillColor('#111827')
            .text(`ORDRE DE MISSION N°${orderNumber} - PROQUELEC`, 42, 104, {
                width: 510,
                align: 'center'
            });
        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748b')
            .text(`Dakar, le ${formatDateFr(missionData.date || mission.createdAt)}`, 390, 36, {
                width: 162,
                align: 'right'
            });
        doc.moveTo(124, 126).lineTo(510, 126).strokeColor('#4f46e5').lineWidth(2).stroke();

        let y = 152;
        y = drawMembersHeader(doc, y);
        if (members.length === 0) {
            doc.rect(42, y, 510, 30).strokeColor('#eeeeee').stroke();
            y += 42;
        } else {
            members.slice(0, 5).forEach((member, index) => {
                doc.rect(42, y, 510, 30).strokeColor('#eeeeee').stroke();
                doc.fillColor('#111827').font('Helvetica').fontSize(9);
                doc.text(String(index + 1), 58, y + 10, { width: 40 });
                doc.text(member.name || '—', 128, y + 10, { width: 190 });
                doc.text(member.role || '—', 340, y + 10, { width: 100 });
                doc.text(member.unit || '—', 470, y + 10, { width: 60 });
                y += 30;
            });
            y += 14;
        }

        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Sont autorises a se rendre en mission :', 42, y);
        y += 24;

        y = drawMissionTable(doc, [
            { type: 'header', label: 'LIEU & DATE' },
            { label: 'Pays ou Region', value: missionData.region, height: 36 },
            { label: 'Date Mission', value: formatDateFr(mission.startDate || missionData.startDate), height: 36 },
            { type: 'header', label: 'DETAILS LOGISTIQUES' },
            { label: 'Objet de la mission', value: mission.title || missionData.purpose, height: 46 },
            { label: 'Moyen de transport', value: missionData.transport || 'Vehicule de service', height: 36 },
            { label: 'Itineraire Aller', value: mission.description || missionData.itineraryAller, height: 36 },
            { label: 'Itineraire Retour', value: missionData.itineraryRetour, height: 36 },
            { label: 'Retour Prevu le', value: formatDateFr(mission.endDate || missionData.endDate), height: 36 },
        ], y);

        y += 16;
        doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(8).text(
            'Le present ordre de mission devra etre presente pour validation finale et restitue au Responsable Administratif & Financier par les interesses des leur retour.',
            42,
            y,
            { width: 510 }
        );

        const signatureY = 690;
        doc.image(qrBuffer, 42, signatureY, { fit: [64, 64] });
        doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(6).text('SCANNEZ POUR VERIFIER', 42, signatureY + 68, {
            width: 90
        });

        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Validation finale', 372, signatureY + 8, {
            width: 140,
            align: 'center'
        });
        doc.moveTo(330, signatureY + 72).lineTo(530, signatureY + 72).strokeColor('#bdbdbd').lineWidth(0.7).stroke();
        doc.fillColor('#a3a3a3').font('Helvetica-Oblique').fontSize(8).text('Signature DG', 330, signatureY + 78, {
            width: 200,
            align: 'center'
        });

        drawPdfFooter(doc, orderNumber, publicUrl);

        doc.addPage({ size: 'A4', margin: 42 });
        drawPdfLogo(doc, logoPath, 42, 30, 96, 38);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(15).text('DECOMPTE FRAIS DE MISSION', 42, 104, {
            width: 510,
            align: 'center'
        });
        doc.moveTo(124, 126).lineTo(510, 126).strokeColor('#4f46e5').lineWidth(2).stroke();

        let page2Y = 162;
        doc.rect(42, page2Y, 510, 30).fill('#eeeeee');
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
        doc.text('Beneficiaire', 58, page2Y + 10, { width: 160 });
        doc.text('Indemnite journaliere', 228, page2Y + 10, { width: 110, align: 'right' });
        doc.text('Nombre de jours', 352, page2Y + 10, { width: 80, align: 'right' });
        doc.text('Total Indemnite', 448, page2Y + 10, { width: 86, align: 'right' });
        page2Y += 34;
        let grandTotal = 0;
        if (members.length === 0) {
            doc.rect(42, page2Y, 510, 30).strokeColor('#eeeeee').stroke();
            doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Aucun beneficiaire renseigne.', 58, page2Y + 10);
            page2Y += 34;
        } else {
            members.forEach(member => {
                if (page2Y > 640) {
                    drawPdfFooter(doc, orderNumber, publicUrl);
                    doc.addPage({ size: 'A4', margin: 42 });
                    drawPdfLogo(doc, logoPath, 42, 30, 96, 38);
                    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text('DECOMPTE FRAIS DE MISSION - SUITE', 42, 104, {
                        width: 510,
                        align: 'center'
                    });
                    doc.moveTo(124, 126).lineTo(510, 126).strokeColor('#4f46e5').lineWidth(2).stroke();
                    page2Y = 162;
                }
                const days = Number(member.days || 1);
                const daily = Number(member.dailyIndemnity || 0);
                const total = daily * days;
                grandTotal += total;
                doc.rect(42, page2Y, 510, 30).strokeColor('#eeeeee').stroke();
                doc.fillColor('#111827').font('Helvetica').fontSize(9);
                doc.text(member.name || '—', 58, page2Y + 10, { width: 160 });
                doc.text(`${daily.toLocaleString('fr-FR')} FCFA`, 228, page2Y + 10, { width: 110, align: 'right' });
                doc.text(String(days), 352, page2Y + 10, { width: 80, align: 'right' });
                doc.text(`${total.toLocaleString('fr-FR')} FCFA`, 448, page2Y + 10, { width: 86, align: 'right' });
                page2Y += 34;
            });
        }
        page2Y += 12;
        doc.roundedRect(330, page2Y, 222, 40, 6).fill('#f8fafc').strokeColor('#e2e8f0').stroke();
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('Montant total en FCFA', 346, page2Y + 9);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(14).text(`${grandTotal.toLocaleString('fr-FR')} FCFA`, 346, page2Y + 22, {
            width: 188,
            align: 'right'
        });
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Validation finale', 372, 642, {
            width: 140,
            align: 'center'
        });
        doc.moveTo(330, 712).lineTo(530, 712).strokeColor('#bdbdbd').lineWidth(0.7).stroke();
        drawPdfFooter(doc, orderNumber, publicUrl);

        doc.addPage({ size: 'A4', margin: 42 });
        drawPdfLogo(doc, logoPath, 42, 30, 96, 38);
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(15).text('ANNEXE DE VERIFICATION', 42, 104, {
            width: 510,
            align: 'center'
        });
        doc.moveTo(124, 126).lineTo(510, 126).strokeColor('#4f46e5').lineWidth(2).stroke();

        let page3Y = 158;
        doc.roundedRect(42, page3Y, 510, 138, 6).fill('#f8fafc').strokeColor('#e2e8f0').stroke();
        doc.image(qrBuffer, 62, page3Y + 22, { fit: [90, 90] });
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Verification publique du document', 176, page3Y + 28, {
            width: 330
        });
        doc.fillColor('#475569').font('Helvetica').fontSize(9).text(publicUrl, 176, page3Y + 50, {
            width: 330,
            lineGap: 2
        });
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('Numero OM', 176, page3Y + 86);
        doc.fillColor('#111827').font('Helvetica').fontSize(10).text(orderNumber, 176, page3Y + 98, {
            width: 150
        });
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('Empreinte integrite', 330, page3Y + 86);
        doc.fillColor('#111827').font('Helvetica').fontSize(8).text(workflow?.integrityHash || '—', 330, page3Y + 98, {
            width: 190,
            lineGap: 1
        });

        page3Y += 172;
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Historique d approbation', 42, page3Y);
        page3Y += 22;
        page3Y = drawApprovalAuditTable(doc, approvalSteps, page3Y);

        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Signature Direction Generale', 346, 650, {
            width: 170,
            align: 'center'
        });
        doc.moveTo(330, 712).lineTo(530, 712).strokeColor('#bdbdbd').lineWidth(0.7).stroke();
        doc.fillColor('#a3a3a3').font('Helvetica-Oblique').fontSize(8).text('Cachet et signature', 330, 718, {
            width: 200,
            align: 'center'
        });
        drawPdfFooter(doc, orderNumber, publicUrl);

        doc.end();
    });
};

/**
 * Normalise les valeurs optionnelles pour Prisma (chaîne vide -> null)
 */
const cleanNullable = (val) => (val === "" || val === undefined ? null : val);

// ===============================================
// PUBLIC VERIFICATION (No Auth Required)
// ===============================================

/**
 * Publicly verify a mission by its order number or ID
 */
export const verifyMissionPublic = async (req, res) => {
    try {
        const { identifier } = req.params;

        const mission = await prisma.mission.findFirst({
            where: {
                OR: [
                    { orderNumber: identifier },
                    { id: identifier }
                ],
                deletedAt: null
            },
            include: {
                organization: {
                    select: { name: true, config: true }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ valid: false, message: 'Ordre de Mission introuvable.' });
        }

        const missionData = typeof mission.data === 'object' ? mission.data : {};
        tracerAction(mission.organizationId, null, 'MISSION_PUBLIC_VERIFY_OPENED', 'Mission', mission.id, {
            identifier,
            orderNumber: mission.orderNumber,
            source: 'public_verify'
        }, req).catch?.(() => {});

        // Prepare safe public response
        return res.json({
            valid: true,
            status: mission.status,
            orderNumber: mission.orderNumber,
            organization: mission.organization.name,
            title: mission.title,
            startDate: mission.startDate,
            endDate: mission.endDate,
            purpose: missionData.purpose,
            region: missionData.region,
            members: (missionData.members || []).map(m => ({
                name: m.name,
                role: m.role
            })),
            isCertified: mission.status === 'approuvee',
            verifiedAt: new Date()
        });
    } catch (error) {
        logger.error('[MISSION_VERIFY_ERROR]', error);
        res.status(500).json({ 
            error: 'Internal server error during verification',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Publicly download the certified mission document by order number or ID.
 */
export const downloadMissionCertifiedDocumentPublic = async (req, res) => {
    try {
        const { identifier } = req.params;
        const mission = await prisma.mission.findFirst({
            where: {
                OR: [
                    { orderNumber: identifier },
                    { id: identifier }
                ],
                status: 'approuvee',
                deletedAt: null
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                },
                organization: { select: { name: true } }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Ordre de Mission certifié introuvable.' });
        }

        const pdfBuffer = await buildMissionDocumentBuffer(mission);
        tracerAction(mission.organizationId, null, 'MISSION_CERTIFIED_DOCUMENT_DOWNLOADED', 'Mission', mission.id, {
            identifier,
            orderNumber: mission.orderNumber,
            source: 'public_download'
        }, req).catch?.(() => {});

        const safeName = (mission.orderNumber || mission.id).replace(/[^\w.-]+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Ordre_Mission_${safeName}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        logger.error('[MISSION_PUBLIC_DOCUMENT_ERROR]', error);
        res.status(500).json({
            error: 'Erreur lors de la génération du document certifié',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Authenticated download of a certified mission document.
 */
export const downloadMissionCertifiedDocument = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { organizationId, id: userId } = req.user;
        const mission = await prisma.mission.findFirst({
            where: {
                id: missionId,
                organizationId,
                status: 'approuvee',
                deletedAt: null
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                },
                organization: { select: { name: true } }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission certifiée introuvable ou non approuvée.' });
        }

        const pdfBuffer = await buildMissionDocumentBuffer(mission);
        await tracerAction(organizationId, userId, 'MISSION_CERTIFIED_DOCUMENT_DOWNLOADED', 'Mission', mission.id, {
            orderNumber: mission.orderNumber,
            source: 'authenticated_download'
        }, req);

        const safeName = (mission.orderNumber || mission.id).replace(/[^\w.-]+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Ordre_Mission_${safeName}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        logger.error('[MISSION_DOCUMENT_ERROR]', error);
        res.status(500).json({
            error: 'Erreur lors de la génération du document certifié',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Endpoint to send a generated document via email
 * POST /api/missions/:missionId/email-document
 */
export const sendMissionDocumentEmail = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { recipientEmail, subject, body } = req.body;
        const { organizationId } = req.user;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Fichier manquant' });
        }

        // 🔒 SECURITY CHECK: Ensure user is from the same organization as the mission
        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId },
            select: { orderNumber: true, title: true }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission introuvable ou accès refusé' });
        }

        await sendMail({
            to: recipientEmail,
            subject: subject || `Ordre de Mission - ${mission.orderNumber || mission.title}`,
            title: 'Votre Ordre de Mission Officiel',
            body: body || `Veuillez trouver ci-joint votre ordre de mission officiel n° ${mission.orderNumber}. <br/><br/>Ce document est certifié numériquement.`,
            attachments: [{
                filename: file.originalname || `Ordre_Mission_${mission.orderNumber}.pdf`,
                content: file.buffer
            }]
        });

        res.json({ success: true, message: 'Email envoyé avec succès' });
    } catch (error) {
        logger.error('[MISSION_EMAIL_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur lors de l\'envoi de l\'email',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * AI Analysis of a mission
 * POST /api/missions/:missionId/analyze-ia
 */
export const analyzeMissionIA = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { organizationId } = req.user;

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission introuvable' });
        }

        const result = await missionMentorService.analyzeMission(mission, req.user);
        res.json(result);
    } catch (error) {
        logger.error('Mission AI analysis endpoint error:', error);
        res.status(500).json({ error: "Erreur lors de l'analyse IA" });
    }
};

// ===============================================
// CORE CRUD
// ===============================================

/**
 * Get all missions for a project
 */
export const getMissions = async (req, res) => {
    try {
        const { projectId, search, status, limit = 50, offset = 0 } = req.query;
        const { organizationId, id: userId, role: rawUserRole } = req.user;

        const userRole = normalizeRole(rawUserRole);

        let whereClause = {
            organizationId,
            projectId: projectId || undefined,
            deletedAt: null
        };

        // FILTRE: Recherche par titre ou description
        if (search) {
            whereClause = {
                ...whereClause,
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { orderNumber: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        // FILTRE: Statut
        if (status) {
            whereClause = { ...whereClause, status };
        }

        if (userRole === 'CHEF_PROJET') {
            // Chef de Projet : voit UNIQUEMENT ses propres missions
            whereClause = { ...whereClause, createdBy: userId };
        } else if (userRole === 'ADMIN_PROQUELEC') {
            // Admin : voit TOUT sans restriction
            // (pas de filtre supplémentaire)
        } else if (userRole === 'DIRECTEUR') {
            // Directeur : voit toutes les missions soumises + ses propres drafts
            whereClause = {
                ...whereClause,
                OR: [
                    { createdBy: userId },           // Ses propres missions (meme drafts)
                    { status: { not: 'draft' } }     // Toutes les missions soumises des autres
                ]
            };
        } else {
            // Autres rôles (COMPTABLE, SUPERVISEUR...) : les leurs + publiées
            whereClause = {
                ...whereClause,
                OR: [
                    { createdBy: userId },
                    { status: { not: 'draft' } }
                ]
            };
        }

        // PAGINATION + COMPTE TOTAL
        const [missions, total] = await Promise.all([
            prisma.mission.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: Math.min(parseInt(limit) || 50, 100),
                skip: parseInt(offset) || 0
            }),
            prisma.mission.count({ where: whereClause })
        ]);

        res.json({ 
            missions,
            pagination: {
                total,
                limit: Math.min(parseInt(limit) || 50, 100),
                offset: parseInt(offset) || 0,
                hasMore: (parseInt(offset) || 0) + missions.length < total
            }
        });
    } catch (error) {
        logger.error('Get missions error:', error);
        res.status(500).json({ error: 'Server error while fetching missions' });
    }
};

/**
 * Get mission statistics (KPI)
 * GET /api/missions/stats
 */
export const getMissionStats = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        const whereClause = {
            organizationId,
            deletedAt: null,
            ...(projectId && { projectId })
        };

        // Compter par statut
        const statusCounts = await prisma.mission.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true
        });

        // Calculer le budget total
        const budgetAggregation = await prisma.mission.aggregate({
            where: { ...whereClause, budget: { not: null } },
            _sum: { budget: true },
            _avg: { budget: true }
        });

        // Missions par mois (derniers 12 mois)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyMissions = await prisma.mission.findMany({
            where: {
                ...whereClause,
                createdAt: { gte: twelveMonthsAgo }
            },
            select: {
                createdAt: true,
                status: true
            }
        });

        // Grouper par mois
        const monthlyStats = {};
        monthlyMissions.forEach(m => {
            const monthKey = m.createdAt.toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { total: 0, approved: 0, draft: 0 };
            }
            monthlyStats[monthKey].total++;
            if (m.status === 'approuvee') monthlyStats[monthKey].approved++;
            if (m.status === 'draft') monthlyStats[monthKey].draft++;
        });

        // Transformer en tableau trié
        const monthlyTrend = Object.entries(monthlyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({ month, ...data }));

        // Construire la réponse
        const stats = {
            total: statusCounts.reduce((sum, s) => sum + s._count, 0),
            byStatus: statusCounts.reduce((acc, s) => {
                acc[s.status] = s._count;
                return acc;
            }, {}),
            budget: {
                total: budgetAggregation._sum.budget || 0,
                average: budgetAggregation._avg.budget || 0
            },
            monthlyTrend
        };

        res.json(stats);
    } catch (error) {
        logger.error('[MISSION_STATS_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la récupération des statistiques missions',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

const safeDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
};

/**
 * Validate mission dates
 */
const validateMissionDates = (startDate, endDate) => {
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            return 'La date de début doit être antérieure à la date de fin';
        }
    }
    return null;
};

/**
 * Validate mission budget
 */
const validateMissionBudget = (budget) => {
    if (budget !== undefined && budget !== null) {
        const numBudget = parseFloat(budget);
        if (isNaN(numBudget)) {
            return 'Le budget doit être un nombre valide';
        }
        if (numBudget < 0) {
            return 'Le budget ne peut pas être négatif';
        }
    }
    return null;
};

const isSubmittedMissionStatus = (status) =>
    status === 'soumise' || status === 'en_attente_validation';

const buildMissionSubmissionData = (data, status) => {
    const safeMissionData = typeof data === 'object' && data !== null ? data : {};
    const shouldMarkSubmitted =
        isSubmittedMissionStatus(status) || safeMissionData.isSubmitted === true;
    const shouldMarkCertified = status === 'approuvee' || safeMissionData.isCertified === true;

    return {
        ...safeMissionData,
        isSubmitted: shouldMarkSubmitted,
        isCertified: shouldMarkCertified,
    };
};

/**
 * Create a new mission
 */
export const createMission = async (req, res) => {
    try {
        let { projectId, title, description, startDate, endDate, budget, data, status } = req.body;
        const { organizationId, id: userId, role: rawUserRole } = req.user;
        const userRole = normalizeRole(rawUserRole);

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID manquante dans le contexte utilisateur' });
        }

        // VALIDATION: Dates
        const dateError = validateMissionDates(startDate, endDate);
        if (dateError) return res.status(400).json({ error: dateError });

        // VALIDATION: Budget
        const budgetError = validateMissionBudget(budget);
        if (budgetError) return res.status(400).json({ error: budgetError });

        // VALIDATION GÉOMÉTRIQUE & TENANTE DU PROJET
        let safeProjectId = cleanNullable(projectId);
        if (safeProjectId && typeof safeProjectId === 'string') {
            const project = await prisma.project.findFirst({
                where: { id: safeProjectId, organizationId }
            });
            if (!project) {
                console.warn(`⚠️ [MISSION] Project ID ${safeProjectId} not found or belongs to another org. Setting to NULL.`);
                safeProjectId = null;
            }
        }

        const normalizedRequestedStatus = (status || '').toString().toLowerCase();
        const canCreateApprovedMission = ['ADMIN_PROQUELEC', 'DIRECTEUR'].includes(userRole);
        const finalStatus =
            normalizedRequestedStatus === 'approuvee' && canCreateApprovedMission
                ? 'approuvee'
                : isSubmittedMissionStatus(normalizedRequestedStatus)
                    ? normalizedRequestedStatus
                    : 'draft';
        const finalData = buildMissionSubmissionData(data, finalStatus);

        const mission = await prisma.mission.create({
            data: {
                projectId: safeProjectId,
                organizationId,
                title: title || 'Nouvelle Mission',
                description: description || '',
                startDate: safeDate(startDate),
                endDate: safeDate(endDate),
                budget: budget ? parseFloat(budget) : 0,
                data: finalData,
                createdBy: userId,
                status: finalStatus
            }
        });

        if (isSubmittedMissionStatus(finalStatus)) {
            try {
                await createDefaultWorkflow(mission.id, organizationId);
            } catch (workflowError) {
                logger.error('[MISSION_CREATE_WORKFLOW_ERROR]', workflowError);
            }

            try {
                await tracerAction(organizationId, userId, 'MISSION_SUBMITTED', 'Mission', mission.id, {
                    title: mission.title,
                    status: finalStatus,
                });
            } catch (auditError) {
                logger.warn('[MISSION_CREATE] submit audit failed:', auditError?.message || auditError);
            }

            missionNotificationService
                .notifyNextStep(mission, 'DIRECTEUR', organizationId)
                .catch((notifError) =>
                    logger.error('[MISSION_CREATE] workflow notification failed:', notifError)
                );
        }

        res.json(mission);
    } catch (error) {
        logger.error('[MISSION_CREATE_ERROR]', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la création de la mission',
            code: 'MISSION_CREATE_FAILED',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Update an existing mission
 */
export const updateMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startDate, endDate, budget, status, data } = req.body;
        const { organizationId, id: userId, role: rawUserRole } = req.user;
        const userRole = rawUserRole?.toUpperCase();

        // Find mission first to verify ownership
        const missionBefore = await prisma.mission.findFirst({
            where: { id, organizationId, deletedAt: null }
        });
        if (!missionBefore) return res.status(404).json({ error: 'Mission not found' });

        // --- PROTECTION: Double Certification ---
        if (missionBefore.status === 'approuvee') {
            return res.status(400).json({ error: 'La mission est déjà certifiée et verrouillée.' });
        }

        if (
            SUBMITTED_MISSION_STATUSES.includes(missionBefore.status) &&
            !['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole) &&
            status !== 'soumise' &&
            status !== 'en_attente_validation'
        ) {
            return res.status(423).json({
                error: 'La mission est déjà soumise. Elle est verrouillée jusqu’à validation ou rejet.'
            });
        }

        if (missionBefore.status === 'rejetee' && status === 'approuvee') {
            return res.status(423).json({
                error: 'Une mission rejetée doit être corrigée puis soumise à nouveau avant validation.'
            });
        }

        // --- PROTECTION: Role DG check ---
        if (status === 'approuvee' && !['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole)) {
            return res.status(403).json({ error: 'Seule la Direction Générale peut certifier une mission.' });
        }

        // VALIDATION: Dates
        const dateError = validateMissionDates(startDate, endDate);
        if (dateError) {
            return res.status(400).json({ error: dateError });
        }

        // VALIDATION: Budget
        const budgetError = validateMissionBudget(budget);
        if (budgetError) {
            return res.status(400).json({ error: budgetError });
        }

        const missionResult = await prisma.$transaction(async (tx) => {
            let finalOrderNumber = missionBefore.orderNumber;

            // --- NUMÉRO UNIQUE (ATOMIQUE): Generation inside transaction ---
            if (status === 'approuvee' && missionBefore.status !== 'approuvee') {
                if (!finalOrderNumber) {
                    const year = new Date().getFullYear();
                    const lastMission = await tx.mission.findFirst({
                        where: {
                            organizationId,
                            orderNumber: { startsWith: `MISSION-${year}-` }
                        },
                        orderBy: { orderNumber: 'desc' }
                    });

                    let sequence = 1;
                    if (lastMission?.orderNumber) {
                        const match = lastMission.orderNumber.match(/MISSION-\d+-(\d+)/);
                        if (match) {
                            sequence = parseInt(match[1]) + 1;
                        }
                    }

                    finalOrderNumber = `MISSION-${year}-${String(sequence).padStart(5, '0')}`;
                }
                logger.info(`✨ Mission ${id} certifiée par le DG. Numéro généré: ${finalOrderNumber}`);
            }

            const safeMissionData = typeof data === 'object' && data !== null ? data : {};

            const updatedMission = await tx.mission.update({
                where: { id },
                data: {
                    ...(title !== undefined && { title }),
                    ...(description !== undefined && { description }),
                    ...(startDate !== undefined && { startDate: safeDate(startDate) }),
                    ...(endDate !== undefined && { endDate: safeDate(endDate) }),
                    ...(budget !== undefined && { budget }),
                    ...(status !== undefined && { status }),
                    ...(data !== undefined && {
                        data:
                            status === 'approuvee'
                                ? { ...safeMissionData, isSubmitted: true, isCertified: true }
                                : data
                    }),
                    ...(finalOrderNumber && { orderNumber: finalOrderNumber })
                }
            });

            return { updatedMission, finalOrderNumber };
        });

        const mission = missionResult.updatedMission;
        const finalOrderNumber = missionResult.finalOrderNumber;

        // WORKFLOW AUTO-GENERATION: Simplified DG logic
        if (status === 'soumise' || status === 'en_attente_validation') {
            const existingWF = await prisma.missionApprovalWorkflow.findUnique({
                where: { missionId: id }
            });
            if (!existingWF) {
                logger.info(`✨ [WORKFLOW] Auto-creating workflow for submitted mission: ${id}`);
                await createDefaultWorkflow(id, organizationId);
            }
            try {
                await tracerAction(organizationId, userId, 'MISSION_SUBMITTED', 'Mission', id, { title, status });
            } catch (e) { console.warn('[AUDIT] Mission submit log failed:', e.message); }

            // EMAIL NOTIFICATION: Alert full chain when a mission is submitted
            try {
                const emails = await findMissionStakeholderEmails(organizationId, [
                    'DG_PROQUELEC',
                    'DIRECTEUR',
                    'ADMIN_PROQUELEC',
                    'COMPTABLE',
                ]);
                for (const email of emails) {
                    missionNotificationService.notifySubmission(mission, email)
                        .catch(err => logger.error('[NOTIF] Stakeholder notification failed:', err));
                }
            } catch (notifErr) {
                logger.error('[NOTIF] Stakeholder lookup failed (non-blocking):', notifErr);
            }
        } else if (status === 'approuvee' && missionBefore.status !== 'approuvee') {
            // THE CERTIFIABLE AUDIT LOG (PROQUELEC)
            try {
                await tracerAction(organizationId, userId, 'MISSION_CERTIFIED_DG', 'Mission', id, {
                    title,
                    status,
                    orderNumber: finalOrderNumber,
                    certifierId: userId,
                    timestamp: new Date().toISOString()
                });
            } catch (e) { console.warn('[AUDIT] Mission certify log failed:', e.message); }

            // Also update the workflow if it exists
            await prisma.missionApprovalWorkflow.updateMany({
                where: { missionId: id },
                data: { overallStatus: 'approved', currentStep: 99, orderNumber: finalOrderNumber, orderNumberGeneratedAt: new Date() }
            });

            // EMAIL: Notify initiator their mission is certified
            if (missionBefore.createdBy) {
                prisma.user.findUnique({ where: { id: missionBefore.createdBy }, select: { email: true } })
                    .then(initiator => {
                        if (initiator?.email) {
                            missionNotificationService.notifyDGCertified(missionBefore, finalOrderNumber, initiator.email)
                                .catch(err => logger.error('[NOTIF] Certified notification failed:', err));
                        }
                    })
                    .catch(err => logger.error('[NOTIF] Initiator lookup failed:', err));
            }
        } else {
            await tracerAction(organizationId, userId, 'MISSION_UPDATE', 'Mission', id, { title, status });
        }

        res.json(mission);
    } catch (error) {
        logger.error('[MISSION_UPDATE_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la mise à jour de la mission',
            code: 'MISSION_UPDATE_FAILED',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};


export const deleteMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId, id: userId } = req.user;

        // 🔒 Ownership check
        const mission = await prisma.mission.findFirst({
            where: { id, organizationId, deletedAt: null }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission introuvable ou accès refusé' });
        }

        await prisma.mission.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        try {
            await tracerAction(organizationId, userId, 'MISSION_DELETE', 'Mission', id);
        } catch (e) { console.warn('[AUDIT] Delete mission log failed:', e.message); }

        res.json({ message: 'Mission supprimée avec succès' });
    } catch (error) {
        logger.error('[MISSION_DELETE_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la suppression de la mission',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Duplicate an existing mission
 */
export const duplicateMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId, id: userId } = req.user;

        const original = await prisma.mission.findFirst({
            where: { id, organizationId, deletedAt: null }
        });

        if (!original) return res.status(404).json({ error: 'Mission originale introuvable' });

        const copy = await prisma.mission.create({
            data: {
                projectId: original.projectId,
                organizationId,
                title: `${original.title} (Copie)`,
                description: original.description,
                startDate: original.startDate,
                endDate: original.endDate,
                budget: original.budget,
                data: original.data || {},
                status: 'draft',
                createdBy: userId
            }
        });

        try {
            await tracerAction(organizationId, userId, 'MISSION_DUPLICATE', 'Mission', id, { newId: copy.id });
        } catch (e) { console.warn('[AUDIT] Duplicate mission log failed:', e.message); }

        res.json(copy);
    } catch (error) {
        logger.error('[MISSION_DUPLICATE_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la duplication de la mission',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

// ===============================================
// WORKFLOW ROLES & SEQUENCE
// ===============================================
const WORKFLOW_ROLES = {
    DIRECTEUR: { sequence: 1, label: 'Direction Générale' },
    ADMIN: { sequence: 99, label: 'Administrateur' },
    ADMIN_PROQUELEC: { sequence: 99, label: 'Administrateur (Super-Pouvoir)' }
};

/**
 * Generate unique order number after DG approval
 * Format: MISSION-YYYY-XXXXX
 */
async function generateOrderNumber(organizationId) {
    const year = new Date().getFullYear();
    const lastMission = await prisma.mission.findFirst({
        where: {
            organizationId,
            orderNumber: {
                startsWith: `MISSION-${year}-`
            }
        },
        orderBy: { orderNumber: 'desc' }
    });

    let sequence = 1;
    if (lastMission?.orderNumber) {
        const match = lastMission.orderNumber.match(/MISSION-\d+-(\d+)/);
        if (match) {
            sequence = parseInt(match[1]) + 1;
        }
    }

    return `MISSION-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Récupère la configuration du workflow d'une organisation
 */
async function _getWorkflowConfig(organizationId) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { config: true }
    });

    if (org?.config?.workflow?.missionSteps) {
        return org.config.workflow.missionSteps;
    }

    // Workflow simplifié: Direction seulement
    return [
        { role: 'DIRECTEUR', sequence: 1, label: 'Directeur Général' }
    ];
}

/**
 * Create default approval workflow based on organization config
 */
async function createDefaultWorkflow(missionId, organizationId) {
    const stepsConfig = await _getWorkflowConfig(organizationId);

    return await prisma.missionApprovalWorkflow.create({
        data: {
            missionId,
            overallStatus: 'pending',
            currentStep: 1,
            approvalSteps: {
                create: stepsConfig.map(s => ({
                    role: s.role,
                    label: s.label,
                    sequence: s.sequence,
                    status: 'EN_ATTENTE'
                }))
            }
        },
        include: {
            approvalSteps: {
                orderBy: { sequence: 'asc' }
            }
        }
    });
}

async function findMissionStakeholderEmails(organizationId, roleNames) {
    const normalizedRoles = (Array.isArray(roleNames) ? roleNames : [roleNames]).flatMap((roleName) => {
        if (roleName === 'DIRECTEUR') {
            return ['DIRECTEUR', 'DG_PROQUELEC', 'DG', 'DIRECTION', 'DIRECTEUR_GENERAL', 'DIR_GEN'];
        }
        if (roleName === 'ADMIN' || roleName === 'ADMIN_PROQUELEC') {
            return ['ADMIN', 'ADMIN_PROQUELEC'];
        }
        return [roleName];
    });

    const stakeholders = await prisma.user.findMany({
        where: {
            organizationId,
            active: true,
            OR: [
                { roleLegacy: { in: normalizedRoles } },
                { role: { is: { name: { in: normalizedRoles } } } },
            ],
        },
        select: {
            email: true,
            notificationEmail: true,
        },
    });

    return [...new Set(stakeholders.map((user) => user.notificationEmail || user.email).filter(Boolean))];
}

/**
 * Get mission approval history and current status
 * @route GET /api/missions/:missionId/approval-history
 */
export const getMissionApprovalHistory = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { organizationId } = req.user;

        // Verify mission exists and belongs to org
        const mission = await prisma.mission.findFirst({
            where: {
                id: missionId,
                organizationId
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: {
                            orderBy: { sequence: 'asc' }
                        }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        // If no workflow exists yet, create one ONLY if mission is NOT a draft
        let workflow = mission.approvalWorkflow;
        if (!workflow && mission.status !== 'draft') {
            workflow = await createDefaultWorkflow(mission.id, organizationId);
        }

        if (!workflow) {
            return res.json({
                missionId: mission.id,
                title: mission.title,
                status: mission.status,
                overallStatus: 'draft',
                steps: []
            });
        }

        return res.json({
            missionId: mission.id,
            title: mission.title,
            orderNumber: mission.orderNumber,
            status: mission.status,
            overallStatus: workflow.overallStatus,
            currentStep: workflow.currentStep,
            steps: workflow.approvalSteps.map(step => ({
                role: step.role,
                label: WORKFLOW_ROLES[step.role]?.label,
                sequence: step.sequence,
                status: step.status,
                approvedBy: step.decidedBy,
                approvedAt: step.decidedAt,
                comment: step.comment
            })),
            orderNumberGeneratedAt: workflow.orderNumberGeneratedAt,
            orderNumberGeneratedBy: workflow.orderNumberGeneratedBy,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt
        });

    } catch (error) {
        logger.error('[MISSION_HISTORY_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la récupération de l\'historique',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Approve a mission step in the workflow
 * Workflow: submission by requester → final approval by DIRECTEUR or ADMIN
 * After final approval → auto-generate orderNumber
 * ADMIN can approve immediately (super-power)
 * 
 * @route POST /api/missions/:missionId/approve
 */
export const approveMissionStep = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { role, comment } = req.body;
        const { organizationId, id: userId, role: rawUserRole } = req.user;
        const userRole = rawUserRole?.toUpperCase();

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        // Verify mission exists
        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        // Create workflow if doesn't exist
        let workflow = mission.approvalWorkflow;
        if (!workflow) {
            workflow = await createDefaultWorkflow(missionId, organizationId);
        }

        // Normalize role
        const normalizedRole = (role || '').toString().toUpperCase();

        if (workflow.overallStatus === 'rejected') {
            return res.status(400).json({ error: 'Cannot approve a rejected mission' });
        }

        if (workflow.overallStatus === 'approved') {
            return res.status(400).json({ error: 'Mission is already approved' });
        }

        if (FINAL_MISSION_STATUSES.includes(mission.status)) {
            return res.status(409).json({ error: 'Mission already has a final decision' });
        }

        if (!workflow.approvalSteps.some(step => step.status === 'EN_ATTENTE')) {
            return res.status(409).json({ error: 'No pending approval step remains for this mission' });
        }

        // ==============================================
        // ADMIN OR DIRECTOR (SELF-CREATED) SUPER-POWER
        // ==============================================
        const isSelfCreatedDirector = (userRole === 'DIRECTEUR' || userRole === 'DG_PROQUELEC') && mission.createdBy === userId;
        const isAdmin = userRole === 'ADMIN_PROQUELEC' || userRole === 'ADMIN';

        if ((isAdmin && (normalizedRole === 'ADMIN' || normalizedRole === 'ADMIN_PROQUELEC')) || isSelfCreatedDirector) {
            const updatedSteps = await Promise.all(
                workflow.approvalSteps.map(step =>
                    prisma.missionApprovalStep.update({
                        where: { id: step.id },
                        data: {
                            status: 'APPROUVE',
                            decidedBy: userId,
                            decidedAt: new Date(),
                            comment: comment || (isAdmin ? `Admin approval` : `Auto-validation par le Directeur (Créateur)`),
                            signature: req.body.signature || null
                        }
                    })
                )
            );

            // Fetch current mission data to merge signature
            const currentMission = await prisma.mission.findUnique({ where: { id: missionId }, select: { data: true } });
            const missionData = typeof currentMission?.data === 'object' ? currentMission.data : {};

            // Generate orderNumber after all approvals
            const orderNumber = await generateOrderNumber(organizationId);

            const updatedWorkflow = await prisma.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: {
                    overallStatus: 'approved',
                    currentStep: 99,
                    orderNumber,
                    orderNumberGeneratedAt: new Date(),
                    orderNumberGeneratedBy: userId,
                    integrityHash: crypto.createHash('sha256').update(JSON.stringify({ missionId, orderNumber, timestamp: new Date() })).digest('hex')
                },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            // Update mission status and orderNumber + SIGNATURE
            await prisma.mission.update({
                where: { id: missionId },
                data: {
                    status: 'approuvee',
                    orderNumber,
                    data: {
                        ...missionData,
                        isSubmitted: true,
                        isCertified: true,
                        signatureImage: req.body.signature || missionData?.signatureImage
                    }
                }
            });

            await tracerAction(organizationId, userId, 'MISSION_ADMIN_APPROVED', 'Mission', missionId, {
                orderNumber,
                comment
            });

            // Email Notification: Full Approval (Admin Override)
            missionNotificationService.notifyFullApproval(mission, orderNumber, mission.createdBy)
                .catch(err => logger.error('Admin approval notification failed:', err));

            return res.json({
                success: true,
                message: 'Mission approved by admin (all steps), orderNumber generated',
                missionId,
                projectId: mission.projectId,
                orderNumber,
                integrityHash: updatedWorkflow.integrityHash,
                steps: updatedWorkflow.approvalSteps.map(s => ({
                    role: s.role,
                    status: s.status,
                    decidedBy: s.decidedBy,
                    decidedAt: s.decidedAt,
                    comment: s.comment
                }))
            });
        }

        // ==============================================
        // NORMAL WORKFLOW: Step-by-step approval
        // ==============================================
        const step = workflow.approvalSteps.find(s => s.role === normalizedRole);
        if (!step) {
            return res.status(400).json({ error: `No approval step found for role: ${normalizedRole}` });
        }

        // Authorization check: only user role owner or admin can approve
        const canApproveThisRole = userRole === normalizedRole || (normalizedRole === 'DIRECTEUR' && userRole === 'DG_PROQUELEC');
        if (!isAdmin && !canApproveThisRole) {
            return res.status(403).json({ error: 'Not authorized to approve this step' });
        }

        // Robustness: Separation of duties (Creator cannot approve step 2 or 3 of their own mission)
        // Except for step 1 (initiation) which is usually done by the creator
        if (!isAdmin && mission.createdBy === userId && step.sequence > 1) {
            return res.status(403).json({ error: 'Sécurité : Vous ne pouvez pas approuver les étapes supérieures d\'une mission que vous avez créée.' });
        }

        // Ensure correct sequence (no skipping), except admin overrule path handled earlier
        if (workflow.currentStep !== step.sequence && !isAdmin) {
            return res.status(400).json({ error: 'Approval step is not current step' });
        }

        if (step.status !== 'EN_ATTENTE') {
            return res.status(400).json({ error: 'This step has already been processed' });
        }

        // Transaction for atomic update
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update this step
            const stepUpdate = await tx.missionApprovalStep.updateMany({
                where: { id: step.id, status: 'EN_ATTENTE' },
                data: {
                    status: 'APPROUVE',
                    decidedBy: userId,
                    decidedAt: new Date(),
                    comment: comment || null,
                    signature: req.body.signature || null
                }
            });
            if (stepUpdate.count !== 1) {
                throw new Error('APPROVAL_STEP_ALREADY_PROCESSED');
            }

            // 2. Determine next step
            const allSteps = workflow.approvalSteps;
            const currentStepIndex = allSteps.findIndex(s => s.role === normalizedRole);
            const nextStep = allSteps[currentStepIndex + 1];
            let newCurrentStep = workflow.currentStep;
            let newOverallStatus = 'pending';
            let orderNumber = mission.orderNumber;

            if (nextStep) {
                newCurrentStep = nextStep.sequence;
                if (mission.status === 'draft') {
                    await tx.mission.update({
                        where: { id: missionId },
                        data: { status: 'en_attente_validation' }
                    });
                }
                
                // NOTIFICATION: Inform next role in chain
                missionNotificationService.notifyNextStep(mission, nextStep.role, organizationId)
                    .catch(err => logger.error('[WF-NOTIF] Could not notify next step:', err));

            } else {
                orderNumber = await generateOrderNumber(organizationId);
                newOverallStatus = 'approved';
                newCurrentStep = step.sequence;

                // Merge signature into mission data
                const missionData = typeof mission.data === 'object' ? mission.data : {};
                const updatedMission = await tx.mission.update({
                    where: { id: missionId },
                    data: {
                        status: 'approuvee',
                        orderNumber,
                        data: {
                            ...missionData,
                            isSubmitted: true,
                            isCertified: true,
                            signatureImage: req.body.signature || missionData?.signatureImage
                        }
                    }
                });

                // FINAL NOTIFICATION: Notify Initiator (+ Audit/Financials)
                const initiatorId = mission.createdBy;
                const initiator = await tx.user.findUnique({ where: { id: initiatorId } });
                if (initiator?.email) {
                    missionNotificationService.notifyFullApproval(updatedMission, orderNumber, initiatorId)
                        .catch(err => logger.error('[WF-NOTIF] Full approval notification failed:', err));
                }
            }

            // 3. Update workflow
            const updatedWF = await tx.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: {
                    currentStep: newCurrentStep,
                    overallStatus: newOverallStatus,
                    ...(!nextStep && {
                        orderNumber,
                        orderNumberGeneratedAt: new Date(),
                        orderNumberGeneratedBy: userId,
                        integrityHash: crypto.createHash('sha256').update(JSON.stringify({ missionId, orderNumber, timestamp: new Date() })).digest('hex')
                    })
                },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            return { updatedWF, orderNumber, nextStep };
        });

        try {
            await tracerAction(organizationId, userId, 'MISSION_APPROVED_STEP', 'Mission', missionId, {
                role,
                orderNumber: result.orderNumber,
                comment
            });
        } catch (e) { console.warn('[AUDIT] Mission approve step log failed:', e.message); }

        // ==============================================
        // ASYNC EMAIL NOTIFICATIONS (Normal Workflow)
        // ==============================================
        if (result.nextStep) {
            missionNotificationService.notifyNextStep(mission, result.nextStep.role, organizationId)
                .catch(err => logger.error('Next step notification failed:', err));
        } else {
            missionNotificationService.notifyFullApproval(mission, result.orderNumber, mission.createdBy)
                .catch(err => logger.error('Creator approval notification failed:', err));
        }

        res.json({
            success: true,
            missionId,
            projectId: mission.projectId,
            title: mission.title,
            orderNumber: result.orderNumber,
            overallStatus: result.updatedWF.overallStatus,
            currentStep: result.updatedWF.currentStep,
            integrityHash: result.updatedWF.integrityHash,
            nextRole: result.nextStep?.role || 'NONE',
            steps: result.updatedWF.approvalSteps.map(s => ({
                role: s.role,
                status: s.status,
                approvedBy: s.decidedBy,
                approvedAt: s.decidedAt,
                comments: s.comment
            }))
        });

    } catch (error) {
        if (error.message === 'APPROVAL_STEP_ALREADY_PROCESSED') {
            return res.status(409).json({ error: 'This approval step has already been processed' });
        }
        logger.error('[MISSION_APPROVE_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de l\'approbation de la mission',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Reject a mission in workflow
 * @route POST /api/missions/:missionId/reject
 */
export const rejectMissionStep = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { role, reason, category } = req.body;
        const { organizationId, id: userId } = req.user;

        const normalizedReason = (reason || '').toString().trim();
        const normalizedCategory = (category || 'AUTRE').toString().toUpperCase();

        if (!role || !normalizedReason) {
            return res.status(400).json({ error: 'Role and reason are required' });
        }
        if (normalizedReason.length < 8) {
            return res.status(400).json({ error: 'Le motif du rejet doit être plus précis.' });
        }
        if (!REJECTION_CATEGORIES.has(normalizedCategory)) {
            return res.status(400).json({ error: 'Catégorie de rejet invalide.' });
        }

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        let workflow = mission.approvalWorkflow;
        if (!workflow) {
            workflow = await createDefaultWorkflow(missionId, organizationId);
        }

        if (workflow.overallStatus === 'approved' || workflow.overallStatus === 'rejected') {
            return res.status(409).json({ error: 'Mission already has a final decision' });
        }

        if (FINAL_MISSION_STATUSES.includes(mission.status)) {
            return res.status(409).json({ error: 'Mission already has a final decision' });
        }

        // Déterminer l'étape cible
        const normalizedRole = (role || '').toString().toUpperCase();
        const isAdmin = req.user.role === 'ADMIN_PROQUELEC' || req.user.role === 'ADMIN';

        let step = workflow.approvalSteps.find(s => s.role === normalizedRole);

        // Si c'est un ADMIN qui rejette globalement
        if (!step && isAdmin) {
            // On rejette l'étape courante
            step = workflow.approvalSteps.find(s => s.sequence === workflow.currentStep);
        }

        if (!step) {
            return res.status(400).json({ error: `No approval step found for role: ${role}` });
        }

        if (step.status !== 'EN_ATTENTE') {
            return res.status(409).json({ error: 'This approval step has already been processed' });
        }

        // Transaction for atomic rejection
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update step to REJETE
            const stepUpdate = await tx.missionApprovalStep.updateMany({
                where: { id: step.id, status: 'EN_ATTENTE' },
                data: {
                    status: 'REJETE',
                    decidedBy: userId,
                    decidedAt: new Date(),
                    comment: `[${normalizedCategory}] ${normalizedReason}`
                }
            });
            if (stepUpdate.count !== 1) {
                throw new Error('APPROVAL_STEP_ALREADY_PROCESSED');
            }

            // 2. Update workflow to rejected
            const updatedWF = await tx.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: { overallStatus: 'rejected' },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            // 3. Update mission status
            await tx.mission.update({
                where: { id: missionId },
                data: { status: 'rejetee' }
            });

            return updatedWF;
        });

        try {
            await tracerAction(organizationId, userId, 'MISSION_REJECTED', 'Mission', missionId, {
                role,
                reason: normalizedReason,
                category: normalizedCategory
            });
        } catch (e) { console.warn('[AUDIT] Mission reject log failed:', e.message); }

        // Email Notification: Rejection
        missionNotificationService.notifyRejection(mission, role, `[${normalizedCategory}] ${normalizedReason}`, mission.createdBy)
            .catch(err => logger.error('Rejection notification failed:', err));

        res.json({
            success: true,
            missionId,
            overallStatus: 'rejected',
            rejectedByRole: role,
            rejectionReason: normalizedReason,
            rejectionCategory: normalizedCategory,
            steps: result.approvalSteps.map(s => ({
                role: s.role,
                status: s.status,
                decidedBy: s.decidedBy,
                decidedAt: s.decidedAt,
                comment: s.comment
            }))
        });

    } catch (error) {
        if (error.message === 'APPROVAL_STEP_ALREADY_PROCESSED') {
            return res.status(409).json({ error: 'This approval step has already been processed' });
        }
        logger.error('[MISSION_REJECT_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors du rejet de la mission',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Admin override: Change the generated orderNumber
 * @route POST /api/missions/:missionId/override-order-number
 */
export const overrideOrderNumber = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { newOrderNumber } = req.body;
        const { organizationId, id: userId, role: userRole } = req.user;

        if (userRole !== 'ADMIN' && userRole !== 'ADMIN_PROQUELEC') {
            return res.status(403).json({ error: 'Only admins can override order number' });
        }

        if (!newOrderNumber) {
            return res.status(400).json({ error: 'newOrderNumber is required' });
        }

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        if (!mission.orderNumber) {
            return res.status(400).json({ error: 'Mission has not been approved yet, cannot override orderNumber' });
        }

        // Update mission orderNumber
        const updatedMission = await prisma.mission.update({
            where: { id: missionId },
            data: { orderNumber: newOrderNumber }
        });

        // Track the override in workflow
        await prisma.missionApprovalWorkflow.update({
            where: { missionId },
            data: {
                orderNumberOverridenAt: new Date(),
                orderNumberOverridenBy: userId
            }
        });

        try {
            await tracerAction(organizationId, userId, 'MISSION_ORDER_NUMBER_OVERRIDE', 'Mission', missionId, {
                oldOrderNumber: mission.orderNumber,
                newOrderNumber
            });
        } catch (e) { console.warn('[AUDIT] Mission override log failed:', e.message); }

        res.json({
            success: true,
            missionId,
            orderNumber: updatedMission.orderNumber,
            message: 'Order number updated by admin'
        });

    } catch (error) {
        logger.error('[MISSION_OVERRIDE_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors du changement de numéro',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

/**
 * Get all missions awaiting approval for the current user's role
 * @route GET /api/missions/approvals/pending
 */
export const getPendingApprovals = async (req, res) => {
    try {
        const { organizationId, role: userRole, id: userId } = req.user;
        const isAdmin = userRole === 'ADMIN_PROQUELEC' || userRole === 'ADMIN';

        // Mapping roles from Auth to Workflow
        const roleMapping = {
            'DG_PROQUELEC': 'DIRECTEUR',
            'DG': 'DIRECTEUR',
            'DIRECTION': 'DIRECTEUR',
            'DIRECTEUR_GENERAL': 'DIRECTEUR',
            'DIR_GEN': 'DIRECTEUR',
            'ADMIN_PROQUELEC': 'ADMIN'
        };
        const workflowRole = roleMapping[userRole] || userRole;
        const isDirector = workflowRole === 'DIRECTEUR' || userRole === 'DG_PROQUELEC';

        const { status: queryStatus } = req.query;
        const isArchiveQuery = queryStatus === 'approuvee';

        // Base query: missions in this organization
        const missions = await prisma.mission.findMany({
            where: {
                organizationId,
                deletedAt: null,
                status: isArchiveQuery ? 'approuvee' : { not: 'draft' },
                ...(isArchiveQuery ? {} : {
                    OR: [
                        { status: 'soumise' },
                        { status: 'en_attente_validation', approvalWorkflow: { isNot: null } },
                        {
                            approvalWorkflow: {
                                approvalSteps: {
                                    some: {
                                        status: 'EN_ATTENTE'
                                    }
                                }
                            }
                        }
                    ],
                    NOT: {
                        status: 'approuvee'
                    }
                })
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: {
                            orderBy: { sequence: 'asc' }
                        }
                    }
                },
                project: {
                    select: { name: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // 🟢 FIX : Récupération MANUELLE des noms d'auteurs (évite de modifier le schéma Prisma Client en plein dev)
        const authorIds = [...new Set(missions.map(m => m.createdBy).filter(Boolean))];
        const authors = await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true, roleLegacy: true }
        });

        // Attacher les auteurs aux missions
        const missionsWithAuthors = missions.map(m => ({
            ...m,
            user: authors.find(u => u.id === m.createdBy) || null
        }));

        // Post-filtering logic for non-admin roles
        const filtered = missionsWithAuthors.filter(m => {
            if (isArchiveQuery) {
                return isAdmin || isDirector;
            }

            // 1. Admins and Directors see everything in 'soumise' or 'en_attente_validation'
            if (isAdmin || userRole === 'DG_PROQUELEC') return true;

            // 2. Technical workflow check for others
            const workflow = m.approvalWorkflow;
            if (!workflow) return false; // Non-admins only see missions that have actually entered the workflow

            const step = workflow.approvalSteps.find(s => s.role === workflowRole);
            return step && step.sequence === workflow.currentStep && step.status === 'EN_ATTENTE';
        });

        // --- AGGREGATE STATS (Consumed Budget) ---
        const costAgg = await prisma.mission.aggregate({
            where: {
                organizationId,
                status: 'approuvee',
                deletedAt: null
            },
            _sum: {
                budget: true
            }
        });

        const totalBudgetCertified = Number(costAgg._sum.budget || 0);
        const nowMs = Date.now();
        const pendingDurationsHours = filtered
            .filter(m => m.status !== 'approuvee')
            .map(m => Math.max(0, Math.round((nowMs - new Date(m.updatedAt || m.createdAt).getTime()) / 36_000) / 100));
        const overOneHour = pendingDurationsHours.filter(hours => hours >= 1).length;
        const over24Hours = pendingDurationsHours.filter(hours => hours >= 24).length;
        const avgPendingHours =
            pendingDurationsHours.length > 0
                ? Math.round((pendingDurationsHours.reduce((sum, h) => sum + h, 0) / pendingDurationsHours.length) * 10) / 10
                : 0;

        const approvedWorkflows = await prisma.missionApprovalWorkflow.findMany({
            where: {
                overallStatus: 'approved',
                mission: { organizationId, deletedAt: null }
            },
            select: {
                createdAt: true,
                orderNumberGeneratedAt: true
            },
            take: 200,
            orderBy: { updatedAt: 'desc' }
        });
        const approvalDurations = approvedWorkflows
            .filter(wf => wf.orderNumberGeneratedAt)
            .map(wf => Math.max(0, new Date(wf.orderNumberGeneratedAt).getTime() - new Date(wf.createdAt).getTime()) / 36e5);
        const avgApprovalHours =
            approvalDurations.length > 0
                ? Math.round((approvalDurations.reduce((sum, h) => sum + h, 0) / approvalDurations.length) * 10) / 10
                : 0;

        res.json({ 
            missions: filtered,
            stats: {
                totalBudgetCertified,
                sla: {
                    avgPendingHours,
                    overOneHour,
                    over24Hours,
                    avgApprovalHours,
                    measuredApproved: approvalDurations.length
                }
            }
        });
    } catch (error) {
        logger.error('[MISSION_PENDING_ERROR]', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la récupération des approbations en attente',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

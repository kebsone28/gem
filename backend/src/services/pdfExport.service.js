/**
 * PDF Export Service — GED OS Toolbox
 * Génère des PDF de soumissions formatés (comme KoboToolbox)
 * Utilise pdfmake (déjà dans package.json) + qrcode
 */
import PdfPrinter from 'pdfmake';
import QRCode from 'qrcode';
import logger from '../utils/logger.js';
import prisma from '../core/utils/prisma.js';
import { getFileUrl } from './storage.service.js';

// Définition des polices (pdfmake)
const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(FONTS);

/**
 * Récupère les métadonnées d'une soumission pour le PDF
 */
async function getSubmissionForPdf(submissionId, organizationId) {
  const submission = await prisma.toolboxSubmission.findFirst({
    where: { id: submissionId, organizationId },
    include: {
      submittedBy: { select: { name: true, email: true } },
      household: { select: { numeroordre: true, nom: true } },
    },
  });
  if (!submission) return null;

  // Récupérer la définition du formulaire pour les labels
  let formDefinition = null;
  try {
    const mapping = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId: submission.formKey },
    });
    if (mapping?.mapping) {
      formDefinition = mapping.mapping;
    }
  } catch {
    // Ignorer les erreurs de définition
  }

  return { submission, formDefinition };
}

/**
 * Formate une valeur de soumission pour l'affichage
 */
function formatValue(value, type) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (type === 'image' || type === 'signature' || type === 'file' || type === 'audio' || type === 'video') {
    if (typeof value === 'string' && value.startsWith('http')) {
      return { text: 'Fichier joint', link: value };
    }
    return 'Fichier joint';
  }
  if (type === 'geopoint' && typeof value === 'string') {
    const parts = value.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
  }
  return String(value);
}

/**
 * Génère un PDF pour une soumission
 * @param {string} submissionId - UUID de la soumission
 * @param {string} organizationId - UUID de l'organisation
 * @returns {Promise<Buffer>} Buffer du PDF
 */
export async function generateSubmissionPdf(submissionId, organizationId) {
  const data = await getSubmissionForPdf(submissionId, organizationId);
  if (!data) throw new Error('Submission not found');

  const { submission, formDefinition } = data;
  const values = submission.values || {};
  const metadata = submission.metadata || {};

  // Générer le QR code (pour identifiant unique)
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(submission.id, {
      width: 120,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' },
    });
  } catch {
    qrDataUrl = null;
  }

  // Construire le document PDF
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Soumission ${submission.formKey} - ${submission.clientSubmissionId || submission.id}`,
      author: 'GED OS Toolbox',
      subject: 'Rapport de soumission terrain',
      keywords: `ged-os, toolbox, ${submission.formKey}`,
    },
    header: (currentPage, pageCount) => ({
      text: `GED OS Toolbox — ${submission.formKey} v${submission.formVersion || 'N/A'}`,
      alignment: 'right',
      margin: [40, 20, 40, 0],
      fontSize: 8,
      color: '#94a3b8',
    }),
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} / ${pageCount} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      alignment: 'center',
      fontSize: 7,
      color: '#94a3b8',
    }),
    content: [
      // En-tête
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: 'Rapport de Soumission Terrain',
                fontSize: 18,
                bold: true,
                color: '#1e293b',
                margin: [0, 0, 0, 4],
              },
              {
                text: `Formulaire: ${submission.formKey}`,
                fontSize: 10,
                color: '#475569',
                margin: [0, 0, 0, 2],
              },
              {
                text: `Version: ${submission.formVersion || 'N/A'}`,
                fontSize: 10,
                color: '#475569',
                margin: [0, 0, 0, 2],
              },
              {
                text: `Statut: ${submission.status}`,
                fontSize: 10,
                color: submission.status === 'validated' ? '#059669' : '#d97706',
                margin: [0, 0, 0, 2],
              },
            ],
          },
          qrDataUrl
            ? {
                width: 70,
                image: qrDataUrl,
                alignment: 'right',
              }
            : {},
        ],
      },
      { text: '', margin: [0, 0, 0, 10] },

      // Séparateur
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
      },
      { text: '', margin: [0, 0, 0, 10] },

      // Métadonnées
      {
        text: 'Informations générales',
        fontSize: 13,
        bold: true,
        color: '#1e293b',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ['35%', '65%'],
          body: [
            [
              { text: 'ID Soumission', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.id, fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'ID Client', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.clientSubmissionId || '—', fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'Soumis par', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.submittedBy?.name || submission.submittedBy?.email || 'Inconnu', fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'Date soumission', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('fr-FR') : '—', fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'Dernière sauvegarde', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.savedAt ? new Date(submission.savedAt).toLocaleString('fr-FR') : '—', fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'Ménage', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.household ? `${submission.household.numeroordre} - ${submission.household.nom || ''}` : submission.numeroOrdre || '—', fontSize: 9, color: '#1e293b' },
            ],
            [
              { text: 'Role', fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: submission.role || '—', fontSize: 9, color: '#1e293b' },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },

      // Données du formulaire
      { text: '', margin: [0, 0, 0, 16] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
      },
      { text: '', margin: [0, 0, 0, 10] },

      {
        text: 'Données collectées',
        fontSize: 13,
        bold: true,
        color: '#1e293b',
        margin: [0, 0, 0, 6],
      },
    ],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10,
      color: '#1e293b',
    },
  };

  // Ajouter les champs du formulaire
  if (formDefinition?.survey && Array.isArray(formDefinition.survey)) {
    const rows = [];
    for (const field of formDefinition.survey) {
      const fieldName = field.name;
      const fieldType = field.type?.split(' ')[0] || 'text';
      const fieldLabel = field.label || fieldName;

      if (['begin_group', 'begin_repeat', 'end_group', 'end_repeat', 'note'].includes(fieldType)) {
        if (fieldType === 'begin_group' || fieldType === 'begin_repeat') {
          rows.push([
            { text: fieldLabel, fontSize: 10, bold: true, color: '#2563eb', fillColor: '#eff6ff', colSpan: 2 },
            {},
          ]);
        }
        continue;
      }

      const value = values[fieldName];
      const formatted = formatValue(value, fieldType);

      rows.push([
        { text: fieldLabel, fontSize: 9, bold: true, color: '#475569', fillColor: '#f8fafc' },
        { text: typeof formatted === 'string' ? formatted : JSON.stringify(formatted), fontSize: 9, color: '#1e293b' },
      ]);
    }

    if (rows.length > 0) {
      docDefinition.content.push({
        table: {
          widths: ['40%', '60%'],
          body: rows,
        },
        layout: {
          hLineWidth: (i) => (i === 0 ? 0 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      });
    }
  } else {
    // Fallback: afficher toutes les valeurs brutes
    const entries = Object.entries(values);
    if (entries.length > 0) {
      docDefinition.content.push({
        table: {
          widths: ['40%', '60%'],
          body: entries.map(([key, value]) => [
            { text: key, fontSize: 9, bold: true, color: '#475569', fillColor: '#f8fafc' },
            { text: formatValue(value, 'text'), fontSize: 9, color: '#1e293b' },
          ]),
        },
        layout: {
          hLineWidth: (i) => (i === 0 ? 0 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      });
    } else {
      docDefinition.content.push({
        text: 'Aucune donnée collectée.',
        fontSize: 10,
        color: '#94a3b8',
        italics: true,
      });
    }
  }

  // Métadonnées de synchronisation
  if (Object.keys(metadata).length > 0) {
    docDefinition.content.push(
      { text: '', margin: [0, 0, 0, 16] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
      },
      { text: '', margin: [0, 0, 0, 10] },
      {
        text: 'Métadonnées de synchronisation',
        fontSize: 13,
        bold: true,
        color: '#1e293b',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ['40%', '60%'],
          body: Object.entries(metadata)
            .filter(([key]) => !['media', 'serverValidationIssues', 'attachments'].includes(key))
            .slice(0, 20)
            .map(([key, value]) => [
              { text: key, fontSize: 9, bold: true, color: '#64748b', fillColor: '#f8fafc' },
              { text: typeof value === 'object' ? JSON.stringify(value, null, 2).slice(0, 100) : String(value), fontSize: 9, color: '#1e293b' },
            ]),
        },
        layout: {
          hLineWidth: (i) => (i === 0 ? 0 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      }
    );
  }

  // Générer le PDF
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);

    pdfDoc.end();
  });
}

/**
 * Génère un PDF récapitulatif pour un lot de soumissions
 */
export async function generateSubmissionsSummaryPdf(submissionIds, organizationId) {
  const submissions = await prisma.toolboxSubmission.findMany({
    where: { id: { in: submissionIds }, organizationId },
    orderBy: { savedAt: 'desc' },
    take: 100,
  });

  if (!submissions.length) throw new Error('No submissions found');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Récapitulatif ${submissions.length} soumissions`,
      author: 'GED OS Toolbox',
      subject: 'Rapport de synthèse terrain',
    },
    header: {
      text: `GED OS Toolbox — Synthèse (${submissions.length} soumissions)`,
      alignment: 'right',
      margin: [40, 20, 40, 0],
      fontSize: 8,
      color: '#94a3b8',
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 7,
      color: '#94a3b8',
    }),
    content: [
      {
        text: 'Récapitulatif des soumissions',
        fontSize: 18,
        bold: true,
        color: '#1e293b',
        margin: [0, 0, 0, 4],
      },
      {
        text: `${submissions.length} soumission(s) — ${new Date().toLocaleDateString('fr-FR')}`,
        fontSize: 10,
        color: '#475569',
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ['auto', 'auto', '*', 'auto', 'auto'],
          body: [
            [
              { text: 'ID', fontSize: 8, bold: true, color: '#475569', fillColor: '#f1f5f9' },
              { text: 'FormKey', fontSize: 8, bold: true, color: '#475569', fillColor: '#f1f5f9' },
              { text: 'Statut', fontSize: 8, bold: true, color: '#475569', fillColor: '#f1f5f9' },
              { text: 'N° Ordre', fontSize: 8, bold: true, color: '#475569', fillColor: '#f1f5f9' },
              { text: 'Date', fontSize: 8, bold: true, color: '#475569', fillColor: '#f1f5f9' },
            ],
            ...submissions.map((s) => [
              { text: s.id.slice(0, 8), fontSize: 8, color: '#1e293b' },
              { text: s.formKey, fontSize: 8, color: '#1e293b' },
              { text: s.status, fontSize: 8, color: s.status === 'validated' ? '#059669' : '#d97706' },
              { text: s.numeroOrdre || '—', fontSize: 8, color: '#1e293b' },
              { text: s.savedAt ? new Date(s.savedAt).toLocaleDateString('fr-FR') : '—', fontSize: 8, color: '#1e293b' },
            ]),
          ],
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.5 : 0),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
    ],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10,
      color: '#1e293b',
    },
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

export default { generateSubmissionPdf, generateSubmissionsSummaryPdf };

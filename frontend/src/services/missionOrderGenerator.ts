/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import logger from '../utils/logger';
import type { MissionOrderData } from '../pages/mission/core/missionTypes';

let INDIGO = [67, 56, 202] as [number, number, number];
const DARK = [15, 23, 42] as [number, number, number];
const GRAY = [100, 116, 139] as [number, number, number];
const SUCCESS = [22, 163, 74] as [number, number, number];
const DANGER = [225, 29, 72] as [number, number, number];

const formatCurrency = (n: number): string => {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
};

/**
 * Nettoie les textes corrompus par des résidus d'encodage.
 * Gère deux cas :
 *   1. Entrelacement de '&' (ex: &D&a&k&a&r&) → supprime les '&'
 *   2. Flèche Unicode → rendue en '!'' par jsPDF → remplace par '->'
 */
const cleanMangledText = (text: string | null | undefined): string => {
  if (!text) return '';
  let cleaned = text;

  // Cas 1 : entrelacement de '&' (plus de 3 occurrences = corruption)
  if ((cleaned.match(/&/g) || []).length > 3) {
    cleaned = cleaned.replace(/&/g, '').trim();
  }

  // Cas 2 : artefact de la flèche → (U+2192) rendue en caractères parasites
  // jsPDF avec police Latin-1 peut produire '!'' ou variantes pour le caractère →
  cleaned = cleaned
    .replace(/!'/g, '->') // artefact Latin-1 de →
    .replace(/\u2192/g, '->') // flèche Unicode directe
    .replace(/→/g, '->'); // flèche si passée telle quelle

  return cleaned;
};

export const generateMissionOrderPDF = async (data: MissionOrderData) => {
  // Override branding colors
  if (data.branding?.primaryColor) INDIGO = data.branding.primaryColor;
  const orgName = data.branding?.organizationName || 'PROQUELEC';
  const footerText = data.branding?.footerText || `Document généré par - ${orgName}`;

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ─────────────────────────────────────────────────────────────────
  // PAGE 1 : ORDRE DE MISSION
  // ─────────────────────────────────────────────────────────────────

  // Header : Logo
  try {
    if (data.branding?.logo) {
      doc.addImage(data.branding.logo, 'PNG', 14, 10, 45, 16);
    } else {
      doc.addImage('/logo-proquelec.png', 'PNG', 14, 10, 45, 16);
    }
  } catch {
    /* logo non trouvé, continuer */
  }

  // Date en haut à droite
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dakar, le ${data.date}`, w - 14, 15, { align: 'right' });

  // Titre document
  doc.setTextColor(...DARK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`ORDRE DE MISSION N\u00b0${data.orderNumber} - ${orgName.toUpperCase()}`, w / 2, 40, {
    align: 'center',
  });
  // Ligne décorative sous le titre
  doc.setLineWidth(0.8);
  doc.setDrawColor(...INDIGO);
  doc.line(28, 43, w - 28, 43);
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);

  // Members Table
  autoTable(doc, {
    startY: 52,
    head: [['N°', 'Prénoms et Noms', 'Fonction', 'Unité']],
    body: data.members.map((m, i) => [i + 1, m.name, m.role, m.unit]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: DARK, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Sont autorisés à se rendre en mission :', 14, currentY);
  currentY += 8;

  const detailsData = [
    [
      {
        content: 'LIEU & DATE',
        colSpan: 4,
        styles: { halign: 'center', fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
      },
    ],
    ['Pays ou Région', `: ${cleanMangledText(data.region)}`, 'Date Mission', `: ${data.startDate}`],
    [
      {
        content: 'DÉTAILS LOGISTIQUES',
        colSpan: 4,
        styles: { halign: 'center', fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
      },
    ],
    ['Objet de la mission', { content: `: ${cleanMangledText(data.purpose)}`, colSpan: 3 }],
    ['Moyen de transport', { content: `: ${cleanMangledText(data.transport)}`, colSpan: 3 }],
    ['Itinéraire Aller', { content: `: ${cleanMangledText(data.itineraryAller)}`, colSpan: 3 }],
    ['Itinéraire Retour', { content: `: ${cleanMangledText(data.itineraryRetour)}`, colSpan: 3 }],
    ['Retour Prévu le', { content: `: ${data.endDate || 'À préciser'}`, colSpan: 3 }],
  ];

  autoTable(doc, {
    startY: currentY,
    body: detailsData as any,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 5, halign: 'left', font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 40, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200 + 12;

  if (data.reportObservations) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observations de terrain / Justificatifs :', 14, currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    const splitObs = doc.splitTextToSize(data.reportObservations, w - 28);
    doc.text(splitObs, 14, currentY);
    currentY += splitObs.length * 5 + 8;
  }

  // Note administrative
  currentY += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  const note =
    'Le présent ordre de mission devra être présenté pour certification et restitué au Responsable Administratif & Financier par les intéressés dès leur retour.';
  doc.text(doc.splitTextToSize(note, w - 28), 14, currentY);
  doc.setTextColor(...DARK);
  currentY += 16;

  // ── QR CODE DE VÉRIFICATION GÉNÉRÉ ──
  try {
    const integrityToken = data.integrityHash ? `&h=${data.integrityHash.substring(0, 8)}` : '';
    const verifyUrl = `${window.location.origin}/verify/mission/${data.orderNumber || data.date}${integrityToken}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 100,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', 14, currentY - 5, 20, 20);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('SCANNEZ POUR VÉRIFIER', 14, currentY + 18);

    if (data.integrityHash) {
      doc.setFontSize(6);
      doc.text(`ID-HASH: ${data.integrityHash.toUpperCase()}`, 14, currentY + 22);
    }
    doc.setTextColor(...DARK);
  } catch (qrErr) {
    console.error('QR Generation failed', qrErr);
  }

  // ── BLOC SIGNATURE DG ──
  const dgCenterX = w - 55;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Le Directeur Général', dgCenterX, currentY, { align: 'center' });
  currentY += 5;

  if (data.signatureImage) {
    try {
      const sig = data.signatureImage.startsWith('data:')
        ? data.signatureImage
        : `data:image/png;base64,${data.signatureImage}`;
      doc.addImage(sig, 'PNG', dgCenterX - 30, currentY, 60, 25);
      currentY += 28;
    } catch (e) {
      console.error('Signature failed in PDF', e);
      currentY += 20;
    }
  } else if (data.isCertified) {
    // 🔴 CACHET ÉLECTRONIQUE OFFICIEL
    doc.setDrawColor(220, 38, 38); // Rouge officiel
    doc.setLineWidth(0.8);
    doc.roundedRect(dgCenterX - 35, currentY + 2, 70, 25, 4, 4, 'D');
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('PROQUELEC - DIRECTION GÉNÉRALE', dgCenterX, currentY + 8, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VU ET APPROUVÉ', dgCenterX, currentY + 15, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Signature numérique certifiée', dgCenterX, currentY + 22, { align: 'center' });

    // Remettre couleur par défaut
    doc.setTextColor(...DARK);
    currentY += 32;
  } else {
    // Ligne pour signature manuelle
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(dgCenterX - 30, currentY + 14, dgCenterX + 30, currentY + 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 180, 180);
    doc.text('Signature', dgCenterX, currentY + 20, { align: 'center' });
    doc.setTextColor(...DARK);
    currentY += 25;
  }

  // Tampon CERTIFIÉ CONFORME
  if (data.isCertified) {
    doc.setDrawColor(...SUCCESS);
    doc.setFillColor(240, 255, 244);
    doc.setLineWidth(1.5);
    doc.roundedRect(dgCenterX - 38, currentY, 76, 14, 3, 3, 'FD');
    doc.setTextColor(...SUCCESS);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('\u2713  CERTIFIÉ CONFORME', dgCenterX, currentY + 9.5, { align: 'center' });
    doc.setTextColor(...DARK);
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.3);
  }

  // ─────────────────────────────────────────────────────────────────
  // PAGE 2 : DÉCOMPTE FRAIS
  // ─────────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('DECOMPTE FRAIS DE MISSION', w / 2, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`(${cleanMangledText(data.purpose)})`, w / 2, 32, { align: 'center' });

  const totalFrais = data.members.reduce((sum, m) => sum + m.dailyIndemnity * m.days, 0);

  autoTable(doc, {
    startY: 45,
    head: [['Bénéficiaire', 'Indemnité journalière', 'Nombre de jours', 'Total Indemnité']],
    body: [
      ...data.members.map((m) => [
        m.name,
        formatCurrency(m.dailyIndemnity),
        m.days,
        formatCurrency(m.dailyIndemnity * m.days),
      ]),
      [
        {
          content: 'Montant total en FCFA',
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: formatCurrency(totalFrais),
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
        },
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 6 },
  });

  currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200 + 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Le Directeur Général', dgCenterX, currentY, { align: 'center' });

  if (data.signatureImage) {
    try {
      const sig = data.signatureImage.startsWith('data:')
        ? data.signatureImage
        : `data:image/png;base64,${data.signatureImage}`;
      doc.addImage(sig, 'PNG', dgCenterX - 30, currentY + 5, 60, 25);
    } catch (e) {
      console.error('Signature failed in PDF p2', e);
    }
  } else if (data.isCertified) {
    // 🔴 CACHET ÉLECTRONIQUE OFFICIEL
    doc.setDrawColor(220, 38, 38); // Rouge officiel
    doc.setLineWidth(0.8);
    doc.roundedRect(dgCenterX - 35, currentY + 5, 70, 25, 4, 4, 'D');
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('PROQUELEC - DIRECTION GÉNÉRALE', dgCenterX, currentY + 11, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VU ET APPROUVÉ', dgCenterX, currentY + 18, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Signature numérique certifiée', dgCenterX, currentY + 25, { align: 'center' });
    doc.setTextColor(...DARK);
  }

  // ─────────────────────────────────────────────────────────────────
  // PAGE 3 : PLANNING DÉTAILLÉ
  // ─────────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, w, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('PLANNING DÉTAILLÉ DES ACTIVITÉS', w / 2, 13, { align: 'center' });

  doc.setTextColor(...DARK);
  currentY = 30;

  const planningBody = data.planning.map((step, idx) => {
    const lines = step.split('\n');
    const dayTitle = lines[0] || `Jour ${idx + 1}`;
    const details = lines.slice(1).join('\n');
    return [
      {
        content: dayTitle,
        styles: { fontStyle: 'bold', textColor: INDIGO, fillColor: [245, 245, 255] },
      },
      details,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['JOUR', "DESCRIPTION DÉTAILLÉE DE L'ACTIVITÉ"]],
    body: planningBody as any,
    theme: 'grid',
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 148 } },
    margin: { left: 14, right: 14 },
  });

  // Footer on all pages
  const pageCount = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${footerText} - Page ${p}/${pageCount}`, w / 2, h - 10, { align: 'center' });
  }

  const fileName = (data.orderNumber || 'PROVISOIRE').replace(/\//g, '-');
  doc.save(`Ordre_Mission_${fileName}.pdf`);
  return doc.output('blob');
};

export const generateMissionReportPDF = async (data: MissionOrderData) => {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Header logic (similar to order)
  doc.addImage('/logo-proquelec.png', 'PNG', 14, 14, 45, 12);
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.text(`Dakar, le ${new Date().toLocaleDateString('fr-FR')}`, w - 14, 15, { align: 'right' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RAPPORT DE MISSION', w / 2, 40, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Réf: OM N°${data.orderNumber} - ${cleanMangledText(data.purpose)}`, w / 2, 46, {
    align: 'center',
  });

  // Executive Summary Box
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.1);
  doc.roundedRect(14, 55, w - 28, 30, 2, 2, 'D');

  const completed = data.reportDays?.filter((d) => d.isCompleted).length || 0;
  const total = data.reportDays?.length || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  doc.setFont('helvetica', 'bold');
  doc.text("RÉSUMÉ D'EXÉCUTION", 20, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Taux de complétion : ${pct}% (${completed}/${total} étapes réalisées)`, 20, 68);
  doc.text(`• Période : du ${data.startDate} au ${data.endDate}`, 20, 74);
  doc.text(
    `• Équipe : ${data.members[0]?.name} (Chef de mission) + ${data.members.length - 1} pers.`,
    20,
    80
  );

  // Detail Table
  autoTable(doc, {
    startY: 95,
    head: [['Jour', 'Activité prévue', 'Statut', 'Observations Terrain']],
    body:
      data.reportDays?.map((rd) => [
        `J${rd.day}`,
        rd.title,
        rd.isCompleted ? (rd.location ? 'RÉALISÉ (GPS ✓)' : 'RÉALISÉ') : 'NON RÉALISÉ',
        rd.observation || '-',
      ]) || [],
    theme: 'grid',
    headStyles: { fillColor: DARK, textColor: [255, 255, 255] },
    columnStyles: {
      2: { fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 80, fontSize: 8 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const txt = data.cell.text[0];
        if (txt === 'RÉALISÉ') doc.setTextColor(...SUCCESS);
        else doc.setTextColor(...DANGER);
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // General Observation
  if (data.reportObservations) {
    if (currentY > h - 40) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OBSERVATIONS GÉNÉRALES ET RECOMMANDATIONS', 14, currentY);
    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitObs = doc.splitTextToSize(data.reportObservations, w - 28);
    doc.text(splitObs, 14, currentY);
    currentY += splitObs.length * 5 + 15;
  }

  // Signatures
  if (currentY > h - 50) {
    doc.addPage();
    currentY = 30;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Le Chef de Mission', 40, currentY, { align: 'center' });
  doc.text('Direction Technique (Visa)', w - 60, currentY, { align: 'center' });

  if (data.signatureImage) {
    try {
      doc.addImage(data.signatureImage, 'PNG', 20, currentY + 2, 40, 20);
    } catch (e) {
      logger.error("Erreur lors de l'ajout de la signature au PDF", e);
    }
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Reporting System PROQUELEC - Page ${p}/${pageCount}`, w / 2, h - 10, {
      align: 'center',
    });
  }

  // Annex : Photos Gallery
  const photos = data.reportDays?.filter((rd) => rd.photo) || [];
  if (photos.length > 0) {
    doc.addPage();
    currentY = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...DARK);
    doc.text('ANNEXE : GALERIE PHOTOS TERRAIN', 14, currentY);
    currentY += 15;

    photos.forEach((p) => {
      if (currentY > h - 80) {
        doc.addPage();
        currentY = 20;
      }

      try {
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text(`Jour ${p.day} : ${p.title}`, 14, currentY);
        currentY += 5;
        doc.addImage(p.photo!, 'JPEG', 14, currentY, 80, 60);
        currentY += 70;
      } catch (err) {
        logger.error('Error adding photo to PDF', err);
      }
    });
  }

  doc.save(`Rapport_Mission_${data.orderNumber.replace('/', '-')}.pdf`);
};

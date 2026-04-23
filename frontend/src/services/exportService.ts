/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logger from '../utils/logger';

export interface ExportOptions {
  filename?: string;
  title: string;
  subtitle?: string;
  orientation?: 'p' | 'l';
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => {
  if (!n && n !== 0) return '-';
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '-' : '') + formatted;
};

const fmtFCFA = (n: number) => {
  if (!n && n !== 0) return '-';
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '-' : '') + formatted + ' FCFA';
};

const addHeader = (pdf: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Header band
  pdf.setFillColor(79, 70, 229); // Indigo-600
  pdf.rect(0, 0, pageWidth, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PROQUELEC · GEM SaaS', 10, 11);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    10,
    18
  );

  // Title below band
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title.toUpperCase(), 10, 38);

  if (subtitle) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text(subtitle, 10, 44);
  }
};

const addFooters = (pdf: jsPDF) => {
  const totalPages = (
    pdf as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
    pdf.text(
      'Document genere automatiquement par la plateforme GEM SaaS PROQUELEC.',
      10,
      pageHeight - 9
    );
    pdf.text(`Page ${p}/${totalPages}`, pageWidth - 20, pageHeight - 9);
  }
};

// ─── Financial PDF export (structured, no screenshot) ────────────────────────

export const exportFinancialPDF = async (
  devisReport: Record<string, unknown>[],
  devis: Record<string, unknown>,
  stats: Record<string, unknown>,
  projectName?: string
): Promise<true | string> => {
  try {
    const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

    addHeader(
      pdf,
      'Bilan Financier Prévisionnel',
      `Projet : ${projectName || 'N/A'} — Plafond devis : ${fmtFCFA(devis.ceiling as any)}`
    );

    // ── KPI summary ──────────────────────────────────────────────────────
    const kpiY = 52;
    const kpiData = [
      ['Total Estimé', "Main d'Œuvre", 'Logistique', 'Marge Globale', 'Performance'],
      [
        fmtFCFA(stats.total as any),
        fmtFCFA((stats.teams as any) + (stats.supervision as any)),
        fmtFCFA(stats.logistics as any),
        fmtFCFA(devis.globalMargin as any),
        `${(devis.marginPct as any).toFixed(1)} %`,
      ],
    ];

    autoTable(pdf, {
      startY: kpiY,
      head: [kpiData[0]],
      body: [kpiData[1]],
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [148, 163, 184],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { fontSize: 10, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
      columnStyles: {
        3: { textColor: (devis as any).globalMargin >= 0 ? [16, 185, 129] : [239, 68, 68] },
        4: { textColor: [79, 70, 229] },
      },
      margin: { left: 10, right: 10 },
      theme: 'grid',
    });

    const afterKPI =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200 + 8;

    // ── Devis vs Réel table ───────────────────────────────────────────────
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('COMPARATIF DEVIS vs RÉALISATION', 10, afterKPI);

    autoTable(pdf, {
      startY: afterKPI + 4,
      head: [
        [
          'Poste de Depense',
          'Region',
          'Qte Prevu',
          'P.U Prevu',
          'Total Prevu',
          'Qte Reel',
          'P.U Reel',
          'Total Reel',
          'Ecart / Marge',
        ],
      ],
      body: devisReport.map((item: any) => [
        item.label,
        item.region,
        fmtNum(item.qty as any),
        fmtFCFA(item.unit as any),
        fmtFCFA(item.planned as any),
        fmtNum(item.rq as any),
        fmtFCFA(item.ru as any),
        fmtFCFA(item.realTotal as any),
        fmtFCFA(item.margin as any),
      ]),
      foot: [
        [
          'TOTAUX CONSOLIDES',
          '',
          '',
          '',
          fmtFCFA(devis.totalPlanned as any),
          '',
          '',
          fmtFCFA(devis.totalReal as any),
          fmtFCFA(devis.globalMargin as any),
        ],
      ],
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 55 },
        8: {
          fontStyle: 'bold',
          textColor: (devis as any).globalMargin >= 0 ? [16, 185, 129] : [239, 68, 68],
        },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 8) {
          const marginStr = data.row.raw[8];
          const margin = parseFloat(String(marginStr || '0').replace(/[^\d-]/g, ''));
          data.cell.styles.textColor = margin >= 0 ? [16, 185, 129] : [239, 68, 68];
        }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
      theme: 'grid',
    });

    addFooters(pdf);

    pdf.save(`bilan_financier_${projectName || 'rapport'}_${Date.now()}.pdf`);
    return true;
  } catch (error: unknown) {
    const err = error as { message?: string; toString?: () => string };
    logger.error('Export error:', error);
    return err.message || (err.toString?.() as string) || 'Erreur inconnue jsPDF';
  }
};

// ─── Generic legacy export (kept for compatibility) ──────────────────────────

export const exportToPDF = async (
  _elementId: string,
  _options: ExportOptions
): Promise<true | string> => {
  return 'Utilisez exportFinancialPDF pour les rapports financiers.';
};

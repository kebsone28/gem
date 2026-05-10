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

import { generateRapportFinancier } from './reportGenerator';

export const exportFinancialPDF = async (
  devisReport: any[],
  devis: any,
  stats: any,
  projectName?: string
): Promise<true | string> => {
  try {
    generateRapportFinancier({
      devisReport,
      totalPlanned: devis.totalPlanned,
      totalReal: devis.totalReal,
      globalMargin: devis.globalMargin,
      marginPct: devis.marginPct,
      ceiling: devis.ceiling,
      stats,
      projectName,
    });
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

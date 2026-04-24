/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/word_engine/index.ts
import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  TableOfContents,
  BorderStyle,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { COLORS, createText } from './utils/styles';
import { createFrontPage } from './sections/frontPage';
import { createRoleSection } from './sections/roleSection';
import { createGeneralSection } from './sections/generalSection';
import { generateQRCodeBuffer } from './utils/qrcodeGenerator';
import logger from '../logger';

export interface ExportData {
  role: string;
  introduction: string;
  missions: string[];
  materials: string[];
  hse: string[];
  subcontracting: string[];
  finances: string[];
  legal?: string[];
  startDate: string;
  endDate: string;
  responsible: string;
  contact: string;
  imagePath?: string;
  technicalImages?: { url: string; label: string }[];
  pricing?: {
    dailyRate: number;
    personnelCount: number;
    durationDays: number;
    penalties: string;
    currency: string;
  };
}

const PAGE_PROPERTIES = {
  page: {
    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
  },
};

const DOCUMENT_HEADER = new Header({
  children: [
    new Paragraph({
      children: [
        createText('BORDEREAU TECHNIQUE ET CONTRACTUEL ', { color: COLORS.SLATE, size: 16 }),
        createText(' | GEM-PROQUELEC', { bold: true, color: COLORS.PRIMARY, size: 16 }),
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, space: 1, color: COLORS.BORDER } },
      alignment: AlignmentType.RIGHT,
    }),
  ],
});

const DOCUMENT_FOOTER = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        createText('Copyright © 2026 PROQUELEC - Généré via la plateforme GEM-PROQUELEC - Page ', {
          size: 16,
          color: COLORS.SLATE,
        }),
        // @ts-expect-error - PAGE_NUMBER field requires special handling
        new TextRun({ children: ['PAGE_NUMBER'], field: 'PAGE_NUMBER', size: 16, bold: true }),
        createText(' sur ', { size: 16, color: COLORS.SLATE }),
        // @ts-expect-error - NUMPAGES field requires special handling
        new TextRun({ children: ['NUMPAGES'], field: 'NUMPAGES', size: 16, bold: true }),
      ],
    }),
  ],
});

export const exportCahiersToWord = async (
  tasks: ExportData[],
  isMultiple: boolean,
  generalClauses?: string[]
) => {
  if (!tasks || tasks.length === 0) {
    logger.warn('[word_engine] exportCahiersToWord called with empty tasks array');
    return;
  }

  const allSections: any[] = [];
  const commonProps = {
    ...PAGE_PROPERTIES,
    headers: { default: DOCUMENT_HEADER },
    footers: { default: DOCUMENT_FOOTER },
  };

  // 1. Front Page
  const mainTitle = isMultiple ? 'Cahiers des Charges Complets' : tasks[0].role || 'Sans titre';
  const safeRole = tasks[0].role?.replace(/\s+/g, '_') || 'lot';
  const qrText = `https://gem-saas.proquelec.sn/verify/${safeRole}_${Date.now()}`;
  const qrBuffer = await generateQRCodeBuffer(qrText);

  allSections.push({
    ...PAGE_PROPERTIES,
    children: createFrontPage(mainTitle),
  });

  // 1.5 Sommaire Dynamique
  allSections.push({
    ...commonProps,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          createText('SOMMAIRE EXÉCUTIF', { bold: true, size: 36, color: COLORS.PRIMARY }),
        ],
        spacing: { before: 400, after: 600 },
      }),
      new TableOfContents('Sommaire', {
        hyperlink: true,
        headingStyleRange: '1-3',
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  });

  // 2. Dispositions Générales
  if (generalClauses && generalClauses.length > 0) {
    allSections.push({
      ...commonProps,
      children: createGeneralSection(generalClauses),
    });
  }

  // 3. Trade Sections
  for (const task of tasks) {
    const children = await createRoleSection(task as any, qrBuffer);
    if (tasks.indexOf(task) < tasks.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    allSections.push({
      ...commonProps,
      children,
    });
  }

  const doc = new Document({
    creator: 'GEM-PROQUELEC',
    title: isMultiple ? 'Cahiers des Charges Complets' : `Cahier des Charges ${tasks[0].role}`,
    sections: allSections,
  });

  const blob = await Packer.toBlob(doc);
  const safeRoleName = tasks[0].role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const fileName = isMultiple
    ? 'BORDEREAU_CONTRACTUEL_COMPLET_PROQUELEC.docx'
    : `BORDEREAU_${safeRoleName}_PRQ.docx`;
  saveAs(blob, fileName);
};

// src/utils/word_engine/utils/styles.ts
import {
  BorderStyle,
  Paragraph,
  TextRun,
  TableCell,
  AlignmentType,
  ShadingType,
  HeadingLevel,
} from 'docx';

export const COLORS = {
  PRIMARY: '2563eb',
  SECONDARY: '1e1b4b',
  ACCENT: 'f97316',
  SUCCESS: '059669',
  DANGER: 'dc2626',
  SLATE: '475569',
  BORDER: 'cbd5e1',
  WHITE: 'FFFFFF',
  BG_LIGHT: 'F8FAFC',
};

export const noBorder = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

export const createText = (text: string, options: any = {}) =>
  new TextRun({
    text,
    font: 'Segoe UI',
    size: 20,
    ...options,
  });

export const createSectionHeader = (text: string, color: string) => {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    shading: {
      fill: color.replace('#', ''),
      type: ShadingType.SOLID,
      color: 'auto',
    },
    indent: { left: 144 },
    children: [
      createText(`  ${text.toUpperCase()}  `, {
        bold: true,
        size: 22,
        color: COLORS.WHITE,
      }),
    ],
    spacing: { before: 500, after: 250 },
  });
};

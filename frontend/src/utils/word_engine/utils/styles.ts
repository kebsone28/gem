 
// src/utils/word_engine/utils/styles.ts
import { Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } from 'docx';

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

export const createText = (text: string, options: Record<string, unknown> = {}) =>
  new TextRun({
    text,
    font: 'Segoe UI',
    size: 20,
    ...options,
  });

export const parseMarkdownText = (text: string, baseOptions: Record<string, unknown> = {}): TextRun[] => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.filter(p => p.length > 0).map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return createText(part.slice(2, -2), { ...baseOptions, bold: true });
    }
    return createText(part, baseOptions);
  });
};

export const createSectionHeader = (text: string, color: string) => {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    shading: {
      fill: color.replace('#', ''),
      type: ShadingType.SOLID,
      color: 'auto',
    },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'D5E3F5' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D5E3F5' },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
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

// Quality Grid Component - Control quality grid with penalties
import { Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, HeadingLevel, BorderStyle } from 'docx';
import { createText } from '../utils/styles';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { BORDERS } from '../theme/borders';
import { ICONS } from '../theme/icons';

export interface QualityGridItem {
  criteria: string;
  weight: number; // Percentage weight
  target: string;
  method: string;
  penalty: string; // Penalty description
}

export interface QualityGridOptions {
  title: string;
  subtitle?: string;
  items: QualityGridItem[];
  totalWeight: number;
  passingScore: number;
}

/**
 * Creates a quality control grid with penalties for Word documents
 */
export const createQualityGrid = (options: QualityGridOptions) => {
  const { title, subtitle, items, totalWeight, passingScore } = options;

  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      spacing: { before: SPACING.LARGE, after: SPACING.SMALL },
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: FONT_SIZES.H2,
          color: COLORS.PRIMARY,
        }),
      ],
    })
  );

  if (subtitle) {
    children.push(
      new Paragraph({
        spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
        children: [
          createText(subtitle, { size: FONT_SIZES.NORMAL, color: COLORS.GRAY, italics: true }),
        ],
      })
    );
  }

  // Quality Grid Table
  const gridTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS.LIGHT,
    rows: [
      // Header Row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.PRIMARY.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Critère', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.WHITE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.PRIMARY.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Poids %', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.WHITE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.PRIMARY.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Objectif', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.WHITE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.PRIMARY.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Méthode', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.WHITE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.DANGER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Pénalité', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.WHITE }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Data Rows
      ...items.map(item =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  children: [
                    createText(item.criteria, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 10, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 },
                  children: [
                    createText(`${item.weight}%`, { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  children: [
                    createText(item.target, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  children: [
                    createText(item.method, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.BG_DANGER.replace('#', '') },
              children: [
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  children: [
                    createText(item.penalty, { size: FONT_SIZES.SMALL, color: COLORS.DANGER }),
                  ],
                }),
              ],
            }),
          ],
        })
      ),
      // Total Row
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.BG_HEADER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('TOTAL', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.BG_HEADER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText(`${totalWeight}%`, { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.BG_HEADER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText(`Score minimum: ${passingScore}%`, { bold: true, size: FONT_SIZES.SMALL, color: COLORS.SUCCESS }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.BG_HEADER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Validation', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: COLORS.BG_DANGER.replace('#', '') },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  createText('Application', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.DANGER }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(gridTable);

  // Penalty Summary
  children.push(
    new Paragraph({
      spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
      children: [
        new TextRun({
          text: `${ICONS.WARNING} Note sur les pénalités :`,
          bold: true,
          size: FONT_SIZES.NORMAL,
          color: COLORS.DANGER,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      children: [
        createText(
          'Les pénalités sont appliquées automatiquement en cas de non-conformité aux critères de qualité. Le score final doit être supérieur ou égal au score minimum pour validation du lot.',
          { size: FONT_SIZES.SMALL, color: COLORS.GRAY, italics: true }
        ),
      ],
    })
  );

  return children;
};

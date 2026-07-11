// Cover Page Component - Professional cover with image for each trade
import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageBreak,
  TextRun,
} from 'docx';
import { createText } from '../utils/styles';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';

export interface CoverPageOptions {
  title: string;
  subtitle?: string;
  role: string;
  reference?: string;
  imageBuffer?: ArrayBuffer;
  imageType?: 'png' | 'jpeg';
}

/**
 * Creates a professional cover page with image for a trade section
 * Design: clean layout with framed image, subtle borders, and elegant typography
 */
export const createCoverPage = (options: CoverPageOptions) => {
  const { title, subtitle, role, reference, imageBuffer, imageType = 'png' } = options;

  const children: any[] = [];

  // Spacer at top
  children.push(
    new Paragraph({ spacing: { before: SPACING.XL, after: SPACING.LARGE }, children: [] })
  );

  // ── Top decorative bar ──
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.PRIMARY.replace('#', '') },
              children: [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.SECONDARY.replace('#', '') },
              children: [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.PRIMARY.replace('#', '') },
              children: [new Paragraph({ children: [] })],
            }),
          ],
        }),
      ],
    })
  );

  // ── Title Block ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: SPACING.XL, after: SPACING.SMALL },
      children: [
        new TextRun({
          text: 'RÉFÉRENTIEL TECHNIQUE',
          bold: true,
          size: FONT_SIZES.H1,
          color: COLORS.PRIMARY,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: SPACING.SMALL, after: SPACING.TINY },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 52,
          color: COLORS.SECONDARY,
        }),
      ],
    })
  );

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: SPACING.TINY, after: SPACING.LARGE },
        children: [
          new TextRun({
            text: subtitle,
            italics: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.GRAY,
          }),
        ],
      })
    );
  }

  // ── Bottom decorative bar ──
  children.push(
    new Table({
      width: { size: 40, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.ACCENT.replace('#', '') },
              children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [] })],
            }),
          ],
        }),
      ],
    })
  );

  children.push(
    new Paragraph({ spacing: { before: SPACING.LARGE, after: SPACING.MEDIUM }, children: [] })
  );

  // ── Framed Image ──
  if (imageBuffer) {
    // Outer frame table with subtle border
    const imgWidth = 500;
    const imgHeight = 330;

    children.push(
      new Table({
        width: { size: 80, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 12, color: COLORS.BORDER.replace('#', '') },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.BORDER.replace('#', '') },
          left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.BORDER.replace('#', '') },
          right: { style: BorderStyle.SINGLE, size: 12, color: COLORS.BORDER.replace('#', '') },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.WHITE.replace('#', '') },
                children: [
                  // Inner shadow effect via nested table
                  new Table({
                    width: { size: 98, type: WidthType.PERCENTAGE },
                    alignment: AlignmentType.CENTER,
                    borders: {
                      top: {
                        style: BorderStyle.SINGLE,
                        size: 4,
                        color: COLORS.LIGHT_GRAY.replace('#', ''),
                      },
                      bottom: {
                        style: BorderStyle.SINGLE,
                        size: 4,
                        color: COLORS.LIGHT_GRAY.replace('#', ''),
                      },
                      left: {
                        style: BorderStyle.SINGLE,
                        size: 4,
                        color: COLORS.LIGHT_GRAY.replace('#', ''),
                      },
                      right: {
                        style: BorderStyle.SINGLE,
                        size: 4,
                        color: COLORS.LIGHT_GRAY.replace('#', ''),
                      },
                    },
                    rows: [
                      new TableRow({
                        children: [
                          new TableCell({
                            shading: { fill: COLORS.WHITE.replace('#', '') },
                            children: [
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 120, after: 120 },
                                children: [
                                  new ImageRun({
                                    data: imageBuffer,
                                    transformation: { width: imgWidth, height: imgHeight },
                                    type: imageType,
                                  } as any),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph({ spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL }, children: [] })
    );
  }

  // ── Reference line ──
  if (reference) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: SPACING.LARGE, after: SPACING.SMALL },
        children: [
          new TextRun({
            text: `Référence : ${reference}`,
            size: FONT_SIZES.SMALL,
            color: COLORS.GRAY,
            italics: true,
          }),
        ],
      })
    );
  }

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }));

  return children;
};

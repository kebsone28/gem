// Signature component for Word documents - Professional signature blocks
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun, WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface SignatureOptions {
  title?: string;
  signatures: {
    role: string;
    name: string;
    date?: string;
    location?: string;
  }[];
  showDate?: boolean;
  showLocation?: boolean;
}

/**
 * Creates a premium signature block like Deloitte/PwC reports
 * Returns a Table element that renders as professional signature sections
 */
export const createSignature = (options: SignatureOptions) => {
  const { title, signatures, showDate = true, showLocation = false } = options;

  const rows: TableRow[] = [];

  // Title row
  if (title) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${ICONS.DOCUMENT} ${title}`,
                    bold: true,
                    size: FONT_SIZES.H2,
                    color: COLORS.PRIMARY,
                  }),
                ],
                spacing: { before: SPACING.XL, after: SPACING.MEDIUM },
              }),
            ],
          }),
        ],
      })
    );
  }

  // Calculate signature columns
  const columnWidth = 100 / signatures.length;

  // Signature row
  rows.push(
    new TableRow({
      children: signatures.map((sig) => {
        const signatureLines: any[] = [
          new Paragraph({
            children: [
              new TextRun({
                text: sig.role.toUpperCase(),
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.PRIMARY,
              }),
            ],
            spacing: { before: SPACING.LARGE, after: SPACING.SMALL },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '_____________________',
                size: 18,
                color: COLORS.BORDER,
              }),
            ],
            spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: sig.name,
                bold: true,
                size: FONT_SIZES.NORMAL,
                color: COLORS.SLATE,
              }),
            ],
            spacing: { after: SPACING.SMALL },
          }),
        ];

        if (showDate && sig.date) {
          signatureLines.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${ICONS.CALENDAR} ${sig.date}`,
                  size: FONT_SIZES.SMALL,
                  color: COLORS.GRAY,
                }),
              ],
              spacing: { after: SPACING.SMALL },
            })
          );
        }

        if (showLocation && sig.location) {
          signatureLines.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${ICONS.LOCATION} ${sig.location}`,
                  size: FONT_SIZES.SMALL,
                  color: COLORS.GRAY,
                }),
              ],
              spacing: { after: SPACING.SMALL },
            })
          );
        }

        return new TableCell({
          width: { size: columnWidth, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: 'single', size: 2, color: COLORS.PRIMARY },
            bottom: { style: 'none' },
            left: { style: 'none' },
            right: { style: 'none' },
          },
          shading: { fill: COLORS.BG_CARD },
          children: signatureLines,
          margins: { top: SPACING.MEDIUM, bottom: SPACING.MEDIUM, left: SPACING.MEDIUM, right: SPACING.MEDIUM },
        });
      }),
    })
  );

  // Divider
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: BORDERS.NONE,
          columnSpan: signatures.length,
          children: [
            new Paragraph({
              spacing: { before: SPACING.LARGE, after: SPACING.SMALL },
              children: [
                new TextRun({
                  text: '─'.repeat(60),
                  size: 18,
                  color: COLORS.BORDER,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows,
  });
};

// QR Code component for Word documents - Stylized QR code card
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun, ImageRun, WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface QRCodeOptions {
  title?: string;
  description?: string;
  qrCodeBuffer?: ArrayBuffer;
  url?: string;
  showUrl?: boolean;
  size?: number;
}

/**
 * Creates a premium QR code card like modern reports
 * Returns a Table element that renders as a stylized QR code section
 */
export const createQRCode = (options: QRCodeOptions) => {
  const { title, description, qrCodeBuffer, url, showUrl = true, size = 150 } = options;

  const rows: TableRow[] = [];

  // Main card row
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: 'single', size: 3, color: COLORS.PRIMARY },
            bottom: { style: 'single', size: 3, color: COLORS.PRIMARY },
            left: { style: 'single', size: 3, color: COLORS.PRIMARY },
            right: { style: 'single', size: 3, color: COLORS.PRIMARY },
          },
          shading: { fill: COLORS.BG_CARD },
          children: [
            // Title
            ...(title
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: `${ICONS.DOCUMENT} ${title}`,
                        bold: true,
                        size: FONT_SIZES.H3,
                        color: COLORS.PRIMARY,
                      }),
                    ],
                    spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
                  }),
                ]
              : []),
            // Description
            ...(description
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: description,
                        size: FONT_SIZES.SMALL,
                        color: COLORS.GRAY,
                        italics: true,
                      }),
                    ],
                    spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
                  }),
                ]
              : []),
            // QR Code image
            ...(qrCodeBuffer
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
                    children: [
                      new ImageRun({
                        data: qrCodeBuffer,
                        transformation: { width: size, height: size },
                        type: 'png',
                      } as any),
                    ],
                  }),
                ]
              : []),
            // URL text
            ...(showUrl && url
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: `${ICONS.MAP} ${url}`,
                        size: FONT_SIZES.SMALL,
                        color: COLORS.ACCENT,
                        italics: true,
                      }),
                    ],
                    spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
                  }),
                ]
              : []),
            // Scan instruction
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `Scannez pour accéder au document`,
                  size: FONT_SIZES.TINY,
                  color: COLORS.SLATE,
                }),
              ],
              spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
            }),
          ],
          margins: { top: SPACING.MEDIUM, bottom: SPACING.MEDIUM, left: SPACING.MEDIUM, right: SPACING.MEDIUM },
        }),
      ],
    })
  );

  return new Table({
    width: { size: 40, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows,
  });
};

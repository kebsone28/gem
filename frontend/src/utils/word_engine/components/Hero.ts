// Hero component for Word documents - Professional header
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun, ImageRun } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface HeroOptions {
  title: string;
  subtitle?: string;
  lot?: string;
  role?: string;
  responsible?: string;
  period?: string;
  zone?: string;
  version?: string;
  imageBuffer?: ArrayBuffer;
  showKPI?: boolean;
}

/**
 * Creates a premium hero section like Deloitte/PwC reports
 * Returns a Table element that renders as a professional header
 */
export const createHero = (options: HeroOptions) => {
  const {
    title,
    subtitle,
    lot,
    role,
    responsible,
    period,
    zone,
    version,
    imageBuffer,
    showKPI = false,
  } = options;

  const children: any[] = [];

  // Main title with icon
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: SPACING.XL, after: SPACING.MEDIUM },
      children: [
        new TextRun({
          text: `${ICONS.STAR} ${title}`,
          bold: true,
          size: FONT_SIZES.H1,
          color: COLORS.PRIMARY,
        }),
      ],
    })
  );

  // Subtitle
  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: SPACING.SMALL, after: SPACING.LARGE },
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

  // Hero image if provided
  if (imageBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: SPACING.MEDIUM, after: SPACING.LARGE },
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: { width: 500, height: 300 },
            type: 'png',
          } as any),
        ],
      })
    );
  }

  // Info cards row
  const infoCards: any[] = [];
  
  if (lot) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.LOCATION} Lot: ${lot}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  if (role) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.WORKER} Rôle: ${role}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  if (responsible) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.USER} Chef: ${responsible}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  if (period) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.CALENDAR} Période: ${period}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  if (zone) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.MAP} Zone: ${zone}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  if (version) {
    infoCards.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ICONS.DOCUMENT} Version: ${version}`,
            bold: true,
            size: FONT_SIZES.NORMAL,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
      })
    );
  }

  // Info cards in a table
  if (infoCards.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: BORDERS.NONE,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: BORDERS.NONE,
                shading: { fill: COLORS.BG_HEADER },
                children: infoCards,
                margins: { top: SPACING.MEDIUM, bottom: SPACING.MEDIUM, left: SPACING.LARGE, right: SPACING.LARGE },
              }),
            ],
          }),
        ],
      })
    );
  }

  // Divider line
  children.push(
    new Paragraph({
      spacing: { before: SPACING.XL, after: SPACING.LARGE },
      children: [
        new TextRun({
          text: '─'.repeat(50),
          size: 18,
          color: COLORS.BORDER,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  return children;
};

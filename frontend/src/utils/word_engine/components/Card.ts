// Reusable Card component for Word documents
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { MARGINS } from '../theme/spacing';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface CardOptions {
  title?: string;
  icon?: keyof typeof ICONS;
  content: any[]; // Array of Paragraph or other docx elements
  width?: number; // Percentage (default: 100)
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  centered?: boolean;
}

/**
 * Creates a card component with optional title/icon and content
 * Returns a Table element that renders as a card in Word
 */
export const createCard = (options: CardOptions) => {
  const {
    title,
    icon,
    content,
    width = 100,
    backgroundColor = COLORS.BG_CARD,
    borderColor = '#E0F2FE',
    titleColor = COLORS.PRIMARY,
    centered = false,
  } = options;

  const children: any[] = [];

  // Add title row if provided
  if (title || icon) {
    const iconSymbol = icon && ICONS[icon] ? ICONS[icon] : undefined;
    const titleText = iconSymbol ? `${iconSymbol} ${title}` : title;
    
    children.push(
      new Paragraph({
        alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: SPACING.MEDIUM, after: SPACING.MEDIUM },
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: FONT_SIZES.CARD_TITLE,
            color: titleColor,
          }),
        ],
      })
    );
  }

  // Add content
  children.push(...content);

  return new Table({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: {
      top: { style: 'single', size: 6, color: borderColor },
      bottom: { style: 'single', size: 6, color: borderColor },
      left: { style: 'single', size: 6, color: borderColor },
      right: { style: 'single', size: 6, color: borderColor },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: backgroundColor },
            borders: {
              top: { style: 'single', size: 6, color: borderColor },
              bottom: { style: 'single', size: 6, color: borderColor },
              left: { style: 'single', size: 6, color: borderColor },
              right: { style: 'single', size: 6, color: borderColor },
            },
            children,
            margins: MARGINS.CARD,
          }),
        ],
      }),
    ],
  });
};

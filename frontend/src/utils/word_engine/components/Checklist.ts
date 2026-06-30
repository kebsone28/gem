// Checklist component for Word documents
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { MARGINS, SPACING, INDENTS } from '../theme/spacing';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { ICONS } from '../theme/icons';

export interface ChecklistItem {
  text: string;
  checked?: boolean;
  notes?: string;
}

export interface ChecklistOptions {
  title?: string;
  items: ChecklistItem[];
  icon?: keyof typeof ICONS;
  backgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  showNotes?: boolean;
  columns?: number; // Number of columns (default: 1)
}

/**
 * Creates a checklist with optional notes
 * Returns a Table element that renders as a checklist in Word
 */
export const createChecklist = (options: ChecklistOptions) => {
  const {
    title,
    items,
    icon,
    backgroundColor = COLORS.BG_CARD,
    borderColor = '#E0F2FE',
    titleColor = COLORS.PRIMARY,
    showNotes = true,
    columns = 1,
  } = options;

  const children: any[] = [];

  // Add title if provided
  if (title) {
    const iconSymbol = icon && ICONS[icon] ? ICONS[icon] : undefined;
    const titleText = iconSymbol ? `${iconSymbol} ${title}` : title;
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: SPACING.MEDIUM, after: SPACING.MEDIUM },
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: FONT_SIZES.H4,
            color: titleColor,
          }),
        ],
      })
    );
  }

  // Add checklist items
  items.forEach((item) => {
    const checkbox = item.checked ? '☑' : '☐';
    children.push(
      new Paragraph({
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
        indent: { left: INDENTS.LIST },
        children: [
          new TextRun({
            text: `${checkbox} ${item.text}`,
            size: FONT_SIZES.NORMAL,
            color: COLORS.SLATE,
          }),
        ],
      })
    );

    if (showNotes && item.notes) {
      children.push(
        new Paragraph({
          spacing: { before: SPACING.XS, after: SPACING.SMALL },
          indent: { left: INDENTS.SUB_LIST },
          children: [
            new TextRun({
              text: `Observation: ${item.notes}`,
              size: FONT_SIZES.SMALL,
              italics: true,
              color: COLORS.GRAY,
            }),
          ],
        })
      );
    }
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
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

/**
 * Creates a categorized checklist with sections
 * Returns an array of Table elements for each category
 */
export const createCategorizedChecklist = (categories: {
  [key: string]: ChecklistItem[];
}) => {
  const tables: any[] = [];
  
  Object.entries(categories).forEach(([category, items]) => {
    if (items.length > 0) {
      tables.push(
        createChecklist({
          title: category,
          items,
          backgroundColor: COLORS.BG_CARD,
        })
      );
    }
  });
  
  return tables;
};

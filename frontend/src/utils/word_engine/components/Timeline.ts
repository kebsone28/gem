// Timeline component for Word documents - Professional step visualization
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun, WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface TimelineStep {
  title: string;
  description?: string;
  icon?: keyof typeof ICONS;
  status?: 'completed' | 'in_progress' | 'pending';
}

export interface TimelineOptions {
  title?: string;
  steps: TimelineStep[];
  showProgress?: boolean;
}

/**
 * Creates a premium timeline component like Deloitte/PwC reports
 * Returns a Table element that renders as a professional timeline
 */
export const createTimeline = (options: TimelineOptions) => {
  const { title, steps, showProgress = true } = options;

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
                    text: `${ICONS.CLOCK} ${title}`,
                    bold: true,
                    size: FONT_SIZES.H2,
                    color: COLORS.PRIMARY,
                  }),
                ],
                spacing: { before: SPACING.LARGE, after: SPACING.MEDIUM },
              }),
            ],
          }),
        ],
      })
    );
  }

  // Steps rows
  steps.forEach((step, index) => {
    const statusIcon = step.status === 'completed' ? ICONS.CHECK : 
                       step.status === 'in_progress' ? ICONS.TIMER : 
                       ICONS.SQUARE;
    const statusColor = step.status === 'completed' ? COLORS.SUCCESS : 
                       step.status === 'in_progress' ? COLORS.ACCENT : 
                       COLORS.GRAY;

    const stepIcon = step.icon && ICONS[step.icon] ? ICONS[step.icon] : ICONS.STAR;

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            shading: { fill: step.status === 'completed' ? COLORS.BG_LIGHT : COLORS.BG_CARD },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${statusIcon}`,
                    size: 24,
                    color: statusColor,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${index + 1}`,
                    bold: true,
                    size: FONT_SIZES.NORMAL,
                    color: COLORS.PRIMARY,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: 'single', size: 1, color: COLORS.BORDER },
              bottom: index < steps.length - 1 ? { style: 'single', size: 1, color: COLORS.BORDER } : { style: 'none' },
              left: { style: 'none' },
              right: { style: 'none' },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: step.title,
                    bold: true,
                    size: FONT_SIZES.NORMAL,
                    color: COLORS.SLATE,
                  }),
                ],
                spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
              }),
              ...(step.description
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: step.description,
                          size: FONT_SIZES.SMALL,
                          color: COLORS.GRAY,
                          italics: true,
                        }),
                      ],
                      spacing: { after: SPACING.SMALL },
                    }),
                  ]
                : []),
            ],
          }),
        ],
      })
    );
  });

  // Progress indicator
  if (showProgress) {
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedSteps / steps.length) * 100);

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            columnSpan: 3,
            children: [
              new Paragraph({
                spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
                children: [
                  new TextRun({
                    text: `${ICONS.CHART} Progression: ${progress}% (${completedSteps}/${steps.length} étapes)`,
                    bold: true,
                    size: FONT_SIZES.SMALL,
                    color: progress === 100 ? COLORS.SUCCESS : COLORS.ACCENT,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows,
  });
};

// KPI (Key Performance Indicator) component for Word documents
import { Table, TableRow, TableCell, Paragraph, AlignmentType, TextRun } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { MARGINS } from '../theme/spacing';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { ICONS } from '../theme/icons';

export interface KPIOptions {
  value: string | number;
  label: string;
  icon?: keyof typeof ICONS;
  color?: string;
  backgroundColor?: string;
}

/**
 * Creates a KPI card displaying a value and label
 * Returns a Table element that renders as a KPI card in Word
 */
export const createKPI = (options: KPIOptions) => {
  const {
    value,
    label,
    icon,
    color = COLORS.PRIMARY,
    backgroundColor = COLORS.BG_CARD,
  } = options;

  const iconSymbol = icon ? ICONS[icon] : undefined;
  const valueText = iconSymbol ? `${iconSymbol} ${value}` : value;

  return new Table({
    width: { size: 25, type: WidthType.PERCENTAGE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: BORDERS.CARD,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: backgroundColor },
            borders: BORDERS.CARD,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
                children: [
                  new TextRun({
                    text: String(valueText),
                    bold: true,
                    size: FONT_SIZES.KPI_VALUE,
                    color: color,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
                children: [
                  new TextRun({
                    text: label,
                    bold: false,
                    size: FONT_SIZES.KPI_LABEL,
                    color: COLORS.GRAY,
                  }),
                ],
              }),
            ],
            margins: MARGINS.CARD,
          }),
        ],
      }),
    ],
  });
};

/**
 * Creates a row of KPI cards
 * Returns a Table element with multiple KPI cards side by side
 */
export const createKPIRow = (kpis: KPIOptions[]) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows: [
      new TableRow({
        children: kpis.map((kpi) => {
          const kpiTable = createKPI(kpi);
          return new TableCell({
            width: { size: 100 / kpis.length, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            children: [kpiTable],
          });
        }),
      }),
    ],
  });
};

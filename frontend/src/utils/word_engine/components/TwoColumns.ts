// TwoColumns component for Word documents
import { Table, TableRow, TableCell } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { SPACING } from '../theme/spacing';

/**
 * Creates a two-column layout from two components
 * Returns a Table element with two cells side by side
 */
export const createTwoColumns = (leftContent: any, rightContent: any, options?: {
  equalWidth?: boolean;
  leftWidth?: number;
  rightWidth?: number;
  gap?: number;
}) => {
  const {
    equalWidth = true,
    leftWidth = 48,
    rightWidth = 48,
    gap = 2,
  } = options || {};

  const totalWidth = leftWidth + rightWidth + gap;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftWidth, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            children: [leftContent],
            margins: { top: 0, bottom: 0, left: 0, right: gap === 0 ? 0 : SPACING.SMALL / 2 },
          }),
          new TableCell({
            width: { size: rightWidth, type: WidthType.PERCENTAGE },
            borders: BORDERS.NONE,
            children: [rightContent],
            margins: { top: 0, bottom: 0, left: gap === 0 ? 0 : SPACING.SMALL / 2, right: 0 },
          }),
        ],
      }),
    ],
  });
};

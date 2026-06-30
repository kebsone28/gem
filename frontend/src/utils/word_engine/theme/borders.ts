// Border system for Word documents
// Border styles must match docx library types

import { BorderStyle } from 'docx';

export const BORDER_STYLES = {
  NONE: 'none' as const,
  SINGLE: 'single' as const,
  DOUBLE: 'double' as const,
  DASHED: 'dashed' as const,
  DOTTED: 'dotted' as const,
  THICK: 'thick' as const,
};

export const BORDER_SIZES = {
  HAIRLINE: 1,
  THIN: 2,
  NORMAL: 4,
  THICK: 6,
  HEAVY: 8,
  EXTRA_HEAVY: 12,
};

// Predefined border configurations
export const BORDERS = {
  // Card borders
  CARD: {
    top: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THICK, color: '#E0F2FE' },
    bottom: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THICK, color: '#E0F2FE' },
    left: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THICK, color: '#E0F2FE' },
    right: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THICK, color: '#E0F2FE' },
  },
  
  // Light borders
  LIGHT: {
    top: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THIN, color: '#E0F2FE' },
    bottom: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THIN, color: '#E0F2FE' },
    left: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THIN, color: '#E0F2FE' },
    right: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.THIN, color: '#E0F2FE' },
  },
  
  // No borders
  NONE: {
    top: { style: BORDER_STYLES.NONE, size: 0 },
    bottom: { style: BORDER_STYLES.NONE, size: 0 },
    left: { style: BORDER_STYLES.NONE, size: 0 },
    right: { style: BORDER_STYLES.NONE, size: 0 },
  },
  
  // Header borders
  HEADER: {
    top: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.NORMAL, color: '#D5E3F5' },
    bottom: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.NORMAL, color: '#D5E3F5' },
    left: { style: BORDER_STYLES.NONE, size: 0 },
    right: { style: BORDER_STYLES.NONE, size: 0 },
  },
  
  // Section divider
  DIVIDER: {
    top: { style: BORDER_STYLES.SINGLE, size: BORDER_SIZES.NORMAL, color: '#D5E3F5' },
    bottom: { style: BORDER_STYLES.NONE, size: 0 },
    left: { style: BORDER_STYLES.NONE, size: 0 },
    right: { style: BORDER_STYLES.NONE, size: 0 },
  },
};

// Border utilities
export const createBorder = (
  size: keyof typeof BORDER_SIZES,
  color: string,
  style: keyof typeof BORDER_STYLES = 'SINGLE'
) => {
  return {
    top: { style: BORDER_STYLES[style], size: BORDER_SIZES[size], color },
    bottom: { style: BORDER_STYLES[style], size: BORDER_SIZES[size], color },
    left: { style: BORDER_STYLES[style], size: BORDER_SIZES[size], color },
    right: { style: BORDER_STYLES[style], size: BORDER_SIZES[size], color },
  };
};

// Typography system for Word documents
// Font sizes in half-points (Word uses half-points, so 24 = 12pt)

export const FONT_SIZES = {
  // Heading sizes
  H1: 48,      // 24pt
  H2: 40,      // 20pt
  H3: 36,      // 18pt
  H4: 32,      // 16pt
  H5: 28,      // 14pt
  H6: 24,      // 12pt
  
  // Body sizes
  LARGE: 22,   // 11pt
  NORMAL: 20,  // 10pt
  SMALL: 18,   // 9pt
  TINY: 16,    // 8pt
  
  // Special sizes
  KPI_VALUE: 44,  // 22pt
  KPI_LABEL: 20,  // 10pt
  CARD_TITLE: 22,  // 11pt
  CARD_BODY: 18,   // 9pt
};

export const FONT_WEIGHTS = {
  NORMAL: 'normal',
  BOLD: 'bold',
};

export const FONT_FAMILIES = {
  DEFAULT: 'Calibri',
  HEADING: 'Calibri',
  MONOSPACE: 'Consolas',
};

// Typography utilities
export const createHeading = (text: string, level: keyof typeof FONT_SIZES) => {
  return {
    size: FONT_SIZES[level],
    bold: true,
  };
};

export const createBody = (size: keyof typeof FONT_SIZES = 'NORMAL') => {
  return {
    size: FONT_SIZES[size],
    bold: false,
  };
};

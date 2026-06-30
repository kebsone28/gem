// Spacing system for Word documents
// All values in twips (1 twip = 1/20 of a point, 1440 twips = 1 inch)

export const SPACING = {
  // Section spacing
  SECTION_BEFORE: 400,
  SECTION_AFTER: 400,
  
  // Paragraph spacing
  PARAGRAPH_BEFORE: 120,
  PARAGRAPH_AFTER: 120,
  
  // List item spacing
  LIST_BEFORE: 80,
  LIST_AFTER: 80,
  
  // Card spacing
  CARD_PADDING: 250,
  CARD_MARGIN: 200,
  
  // Table cell spacing
  CELL_PADDING: 180,
  CELL_MARGIN: 150,
  
  // Header spacing
  HEADER_BEFORE: 300,
  HEADER_AFTER: 200,
  
  // KPI spacing
  KPI_PADDING: 200,
  
  // Gallery spacing
  GALLERY_GAP: 200,
  
  // Small spacing
  XS: 40,
  TINY: 60,
  SMALL: 80,
  MEDIUM: 120,
  LARGE: 200,
  XL: 300,
  XXL: 400,
};

export const INDENTS = {
  // List indents
  LIST: 280,
  SUB_LIST: 360,
  
  // Blockquote indents
  BLOCKQUOTE: 400,
  
  // Table cell indents
  TABLE_CELL: 200,
};

export const MARGINS = {
  // Page margins
  PAGE_TOP: 1440,
  PAGE_BOTTOM: 1440,
  PAGE_LEFT: 1440,
  PAGE_RIGHT: 1440,
  
  // Card margins
  CARD: {
    top: 250,
    bottom: 250,
    left: 250,
    right: 250,
  },
  
  // Section margins
  SECTION: {
    top: 300,
    bottom: 300,
    left: 0,
    right: 0,
  },
};

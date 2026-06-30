// Premium color palette for Word documents
// Based on professional design systems (Deloitte, PwC, EY style)

export const COLORS = {
  // Primary colors
  PRIMARY: '#0F4C81',
  SECONDARY: '#00A3E0',
  ACCENT: '#8B5CF6',
  
  // Semantic colors
  SUCCESS: '#2E7D32',
  DANGER: '#C62828',
  WARNING: '#F57C00',
  INFO: '#0288D1',
  
  // Neutral colors
  WHITE: '#FFFFFF',
  SLATE: '#1F2937',
  GRAY: '#6B7280',
  LIGHT_GRAY: '#9CA3AF',
  
  // Background colors
  BG_CARD: '#F8FAFC',
  BG_HEADER: '#E8F1FB',
  BG_SECTION: '#F0F9FF',
  BG_LIGHT: '#FAFAFA',
  
  // Border colors
  BORDER: '#D5E3F5',
  BORDER_LIGHT: '#E0F2FE',
  
  // Section-specific backgrounds
  TECHNICAL: 'F0F9FF',
  QUALITY: 'F0FDF4',
  SAFETY: 'FEF2F2',
  FINANCE: 'FFF7ED',
  LEGAL: 'F8FAFC',
};

// Color utilities
export const getSectionColor = (type: 'technical' | 'quality' | 'safety' | 'finance' | 'legal'): string => {
  return SECTION_COLORS[type];
};

const SECTION_COLORS = {
  technical: COLORS.TECHNICAL,
  quality: COLORS.QUALITY,
  safety: COLORS.SAFETY,
  finance: COLORS.FINANCE,
  legal: COLORS.LEGAL,
};

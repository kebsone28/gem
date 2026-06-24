export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgInput: string;
  bgHeader: string;
  bgFooter: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
  chipBg: string;
  chipBorder: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  progressBg: string;
}

export const darkTheme: ThemeColors = {
  bg: '#0a0e27',
  bgCard: '#141832',
  bgInput: '#141832',
  bgHeader: '#000',
  bgFooter: '#000',
  border: '#1e2a4a',
  borderLight: '#2a3a5a',
  text: '#fff',
  textSecondary: '#e8edf5',
  textMuted: '#64748b',
  accent: '#4f8cff',
  accentLight: '#4f8cff25',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ff4757',
  overlay: 'rgba(0,0,0,0.7)',
  chipBg: '#141832',
  chipBorder: '#1e2a4a',
  chipSelectedBg: '#4f8cff25',
  chipSelectedBorder: '#4f8cff',
  progressBg: '#1a1f3a',
};

export const lightTheme: ThemeColors = {
  bg: '#f1f5f9',
  bgCard: '#fff',
  bgInput: '#fff',
  bgHeader: '#fff',
  bgFooter: '#fff',
  border: '#e2e8f0',
  borderLight: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#1e293b',
  textMuted: '#64748b',
  accent: '#2563eb',
  accentLight: '#2563eb15',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  overlay: 'rgba(0,0,0,0.5)',
  chipBg: '#f8fafc',
  chipBorder: '#e2e8f0',
  chipSelectedBg: '#2563eb15',
  chipSelectedBorder: '#2563eb',
  progressBg: '#e2e8f0',
};

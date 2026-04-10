/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS – GEM SAAS | ELECTRIC BLUE PREMIUM
   Source unique de vérité pour toutes les valeurs de design.
   Centralise couleurs, typographie, espacement, radius, ombres et animations.
   ═══════════════════════════════════════════════════════════════════════════ */

export const DESIGN_TOKENS = {

  // ─────────────────────────────────────────────────────────────────────────
  // COLORS – PALETTE ÉLECTRIQUE BLEUE PREMIUM
  // ─────────────────────────────────────────────────────────────────────────
  colors: {
    // Electric Blue – couleur principale de la marque
    primary: {
      50:  '#F0F7FF',
      100: '#E0EEFF',
      200: '#C1DCFF',
      300: '#A2CBFF',
      400: '#83B9FF',
      500: '#1E90FF', // Bleu électrique vif
      600: '#0066FF', // Action principale
      700: '#004FCC',
      800: '#003B99',
      900: '#002766',
      950: '#001433',
    },

    // Accents complémentaires
    accent: {
      cyan:   '#00D4FF',
      indigo: '#6366F1',
      purple: '#A855F7',
    },

    // Couleurs sémantiques de statut
    status: {
      success:      '#10B981',
      successLight: '#D1FAE5',
      successDark:  'rgba(16, 185, 129, 0.15)',
      warning:      '#F59E0B',
      warningLight: '#FEF3C7',
      warningDark:  'rgba(245, 158, 11, 0.15)',
      error:        '#EF4444',
      errorLight:   '#FEE2E2',
      errorDark:    'rgba(239, 68, 68, 0.15)',
      info:         '#3B82F6',
      infoLight:    '#DBEAFE',
      infoDark:     'rgba(59, 130, 246, 0.15)',
    },

    // Nuances neutres (gris) – light mode
    gray: {
      0:   '#FFFFFF',
      50:  '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#020617',
    },

    // Surfaces spéciales dark-mode
    dark: {
      bg:       '#020817',
      surface:  '#050F1F',
      elevated: '#0A1628',
      card:     '#0D1E35',
      border:   'rgba(30, 144, 255, 0.12)',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY – Lexend (headings) + Inter (body)
  // ─────────────────────────────────────────────────────────────────────────
  typography: {
    fonts: {
      heading: "'Lexend', 'Inter', system-ui, sans-serif",
      body:    "'Inter', system-ui, -apple-system, sans-serif",
      mono:    "'JetBrains Mono', 'Fira Code', monospace",
    },

    sizes: {
      xs:   '0.75rem',   // 12px
      sm:   '0.8125rem', // 13px
      base: '0.9375rem', // 15px
      lg:   '1.0625rem', // 17px
      xl:   '1.125rem',  // 18px
      '2xl': '1.375rem', // 22px
      '3xl': '1.75rem',  // 28px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
    },

    weights: {
      light:    300,
      normal:   400,
      medium:   500,
      semibold: 600,
      bold:     700,
      extrabold:800,
      black:    900,
    },

    lineHeights: {
      tight:   1.20,
      snug:    1.35,
      normal:  1.55,
      relaxed: 1.70,
      loose:   2.00,
    },

    letterSpacing: {
      tighter:  '-0.03em',
      tight:    '-0.02em',
      normal:   '0em',
      wide:     '0.05em',
      wider:    '0.10em',
      widest:   '0.20em',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPACING – Échelle 4px de base
  // ─────────────────────────────────────────────────────────────────────────
  spacing: {
    0:    '0',
    0.5:  '0.125rem',  // 2px
    1:    '0.25rem',   // 4px
    1.5:  '0.375rem',  // 6px
    2:    '0.5rem',    // 8px
    2.5:  '0.625rem',  // 10px
    3:    '0.75rem',   // 12px
    4:    '1rem',      // 16px
    5:    '1.25rem',   // 20px
    6:    '1.5rem',    // 24px
    7:    '1.75rem',   // 28px
    8:    '2rem',      // 32px
    10:   '2.5rem',    // 40px
    12:   '3rem',      // 48px
    16:   '4rem',      // 64px
    20:   '5rem',      // 80px
    24:   '6rem',      // 96px
    32:   '8rem',      // 128px
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BORDER RADIUS
  // ─────────────────────────────────────────────────────────────────────────
  radius: {
    none: '0',
    xs:   '4px',
    sm:   '6px',
    md:   '8px',
    lg:   '12px',
    xl:   '16px',
    '2xl':'20px',
    '3xl':'28px',
    full: '9999px',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SHADOWS – Système d'élévation
  // ─────────────────────────────────────────────────────────────────────────
  shadows: {
    none:     'none',
    xs:       '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    sm:       '0 2px 6px 0 rgba(0, 0, 0, 0.05)',
    md:       '0 4px 12px 0 rgba(0, 0, 0, 0.07)',
    lg:       '0 8px 24px 0 rgba(0, 0, 0, 0.09)',
    xl:       '0 12px 32px 0 rgba(0, 0, 0, 0.12)',
    '2xl':    '0 16px 40px 0 rgba(0, 0, 0, 0.16)',
    inner:    'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
    electric: '0 8px 25px rgba(30, 144, 255, 0.25)',
    glow:     '0 0 15px rgba(0, 102, 255, 0.20)',
    focus:    '0 0 0 3px rgba(30, 144, 255, 0.15)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GRADIENTS
  // ─────────────────────────────────────────────────────────────────────────
  gradients: {
    electric:     'linear-gradient(135deg, #0066CC 0%, #1E90FF 40%, #00C6FF 100%)',
    primary:      'linear-gradient(135deg, #0066FF 0%, #1E90FF 50%, #00D4FF 100%)',
    cardHeader:   'linear-gradient(135deg, #0052A3 0%, #1E90FF 60%, #38BAFF 100%)',
    subtle:       'linear-gradient(135deg, #F0F7FF 0%, #E0EEFF 50%, #F0F4FF 100%)',
    darkSubtle:   'linear-gradient(135deg, rgba(30, 144, 255, 0.10) 0%, rgba(0, 102, 255, 0.05) 100%)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BREAKPOINTS – Design responsive
  // ─────────────────────────────────────────────────────────────────────────
  breakpoints: {
    sm:  '640px',
    md:  '768px',
    lg:  '1024px',
    xl:  '1280px',
    '2xl': '1536px',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Z-INDEX – Système de couches
  // ─────────────────────────────────────────────────────────────────────────
  zIndex: {
    base:      0,
    raised:    10,
    dropdown:  100,
    sticky:    200,
    overlay:   300,
    modal:     500,
    toast:     1000,
    tooltip:   1100,
    max:       9999,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ANIMATIONS – Durées et courbes d'accélération
  // ─────────────────────────────────────────────────────────────────────────
  animations: {
    duration: {
      instant:  '100ms',
      fast:     '150ms',
      normal:   '250ms',
      slow:     '400ms',
      verySlow: '700ms',
    },
    easing: {
      linear:   'linear',
      in:       'cubic-bezier(0.4, 0, 1, 1)',
      out:      'cubic-bezier(0, 0, 0.2, 1)',
      inOut:    'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      spring:   'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS – Accesseurs typés
// ─────────────────────────────────────────────────────────────────────────

export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = DESIGN_TOKENS.colors;
  for (const key of keys) {
    value = value?.[key];
  }
  return value ?? '';
};

export const getSpacing    = (key: keyof typeof DESIGN_TOKENS.spacing) => DESIGN_TOKENS.spacing[key];
export const getRadius     = (key: keyof typeof DESIGN_TOKENS.radius)   => DESIGN_TOKENS.radius[key];
export const getShadow     = (key: keyof typeof DESIGN_TOKENS.shadows)  => DESIGN_TOKENS.shadows[key];
export const getGradient   = (key: keyof typeof DESIGN_TOKENS.gradients)=> DESIGN_TOKENS.gradients[key];
export const getFontSize   = (key: keyof typeof DESIGN_TOKENS.typography.sizes)   => DESIGN_TOKENS.typography.sizes[key];
export const getFontWeight = (key: keyof typeof DESIGN_TOKENS.typography.weights) => DESIGN_TOKENS.typography.weights[key];

// ─────────────────────────────────────────────────────────────────────────
// COMMON CLASS PATTERNS – Classes Tailwind standardisées pour tous les
// composants. Ces classes DOIVENT respecter le design system Electric Blue.
// ─────────────────────────────────────────────────────────────────────────

export const COMMON_CLASSES = {

  // ── LAYOUT ──────────────────────────────────────────────────────────────
  // N.B.: pas de max-w fixe ici : utiliser maxWidth prop du PageContainer
  container:  'w-full mx-auto px-4 sm:px-6 lg:px-8',
  pageWrapper:'p-4 sm:p-6 lg:p-8',
  section:    'mb-8',

  // ── PAGE HEADER ──────────────────────────────────────────────────────────
  pageHeader: 'mb-6 pb-5 border-b border-white/5',

  // ── CARDS ────────────────────────────────────────────────────────────────
  card:
    'bg-[#0D1E35] ' +
    'border border-white/5 ' +
    'rounded-[var(--radius-xl)] shadow-xl ' +
    'transition-all duration-250',
  cardHover:
    'hover:shadow-[var(--shadow-md)] hover:border-blue-400/30 hover:-translate-y-px ' +
    'dark:hover:shadow-[0_8px_30px_rgba(30,144,255,0.10)]',
  cardPadding: 'p-6',
  cardSm:      'p-4',
  cardLg:      'p-8',

  // ── BUTTONS ──────────────────────────────────────────────────────────────
  btnBase:
    'inline-flex items-center justify-center gap-2 font-semibold ' +
    'border-none rounded-[var(--radius-lg)] cursor-pointer whitespace-nowrap ' +
    'select-none transition-all duration-150 will-change-transform',

  btnPrimary:
    'inline-flex items-center justify-center gap-2 font-bold text-white ' +
    'bg-gradient-to-r from-[#0066CC] via-[#1E90FF] to-[#00C6FF] ' +
    'rounded-[var(--radius-lg)] border-none cursor-pointer ' +
    'px-5 py-[0.65rem] text-[0.9rem] tracking-tight ' +
    'shadow-[0_4px_16px_rgba(30,144,255,0.35)] ' +
    'hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(30,144,255,0.45)] ' +
    'active:translate-y-0 active:brightness-95 ' +
    'transition-all duration-150',

  btnSecondary:
    'inline-flex items-center justify-center gap-2 font-semibold ' +
    'bg-white/5 ' +
    'border border-white/10 ' +
    'text-blue-100 ' +
    'rounded-[var(--radius-lg)] cursor-pointer ' +
    'px-5 py-[0.6rem] text-[0.875rem] ' +
    'hover:border-blue-500 hover:text-blue-400 ' +
    'hover:bg-white/10 ' +
    'transition-all duration-150',

  btnDanger:
    'inline-flex items-center justify-center gap-2 font-bold text-white ' +
    'bg-gradient-to-r from-red-600 to-red-500 ' +
    'rounded-[var(--radius-lg)] border-none cursor-pointer ' +
    'px-5 py-[0.65rem] text-[0.875rem] ' +
    'shadow-[0_4px_12px_rgba(239,68,68,0.30)] ' +
    'hover:brightness-110 hover:-translate-y-0.5 ' +
    'active:translate-y-0 transition-all duration-150',

  btnGhost:
    'inline-flex items-center justify-center gap-2 font-medium ' +
    'bg-transparent text-[var(--color-text-secondary)] ' +
    'rounded-[var(--radius-lg)] cursor-pointer ' +
    'px-4 py-[0.55rem] text-[0.875rem] ' +
    'hover:bg-[rgba(30,144,255,0.06)] hover:text-[var(--color-primary)] ' +
    'transition-all duration-150',

  btnIcon:
    'inline-flex items-center justify-center ' +
    'w-9 h-9 rounded-[var(--radius-lg)] cursor-pointer ' +
    'text-[var(--color-text-muted)] ' +
    'hover:bg-[rgba(30,144,255,0.08)] hover:text-[var(--color-primary)] ' +
    'transition-all duration-150',

  // ── FORMS ────────────────────────────────────────────────────────────────
  input:
    'w-full px-3.5 py-[0.625rem] ' +
    'bg-slate-900 ' +
    'border border-white/10 ' +
    'text-white ' +
    'rounded-[var(--radius-lg)] text-sm ' +
    'placeholder:text-blue-300/30 ' +
    'focus:outline-none focus:border-blue-500 ' +
    'focus:ring-2 focus:ring-blue-500/20 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed ' +
    'transition-all duration-150',

  label:
    'block text-xs font-semibold uppercase tracking-[0.06em] ' +
    'text-blue-300/40 mb-1.5',

  formGroup:  'flex flex-col gap-1.5',
  formRow:    'flex flex-col sm:flex-row gap-4',

  // ── TYPOGRAPHY ───────────────────────────────────────────────────────────
  heading1:
    'font-["Lexend",system-ui,sans-serif] text-3xl font-bold leading-tight tracking-tight break-words ' +
    'text-white mb-4',

  heading2:
    'font-["Lexend",system-ui,sans-serif] text-2xl font-bold leading-snug tracking-tight break-words ' +
    'text-white mb-3',

  heading3:
    'font-["Lexend",system-ui,sans-serif] text-xl font-semibold leading-snug break-words ' +
    'text-white mb-2',

  body:
    'text-[0.9375rem] leading-relaxed ' +
    'text-blue-200/60',

  caption:
    'text-xs ' +
    'text-blue-300/40',

  overline:
    'text-[0.7rem] font-bold uppercase tracking-[0.10em] ' +
    'text-blue-300/40',

  // ── STATUS BADGES ────────────────────────────────────────────────────────
  statusSuccess:
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ' +
    'bg-green-100 text-green-800 border border-green-200 ' +
    'dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',

  statusWarning:
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ' +
    'bg-amber-100 text-amber-800 border border-amber-200 ' +
    'dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30',

  statusError:
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ' +
    'bg-red-100 text-red-800 border border-red-200 ' +
    'dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',

  statusInfo:
    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ' +
    'bg-blue-100 text-blue-800 border border-blue-200 ' +
    'dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',

  // ── GRILLES ──────────────────────────────────────────────────────────────
  grid1: 'grid grid-cols-1 gap-6',
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  grid3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  grid4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',

  // ── FLEX ─────────────────────────────────────────────────────────────────
  flexCenter:  'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart:   'flex items-center justify-start gap-3',
  flexEnd:     'flex items-center justify-end gap-3',
  flexCol:     'flex flex-col gap-4',

  // ── LOADERS ──────────────────────────────────────────────────────────────
  spinner:
    'w-8 h-8 rounded-full border-4 ' +
    'border-[rgba(30,144,255,0.20)] border-t-[var(--color-primary)] ' +
    'animate-spin',

  spinnerSm:
    'w-5 h-5 rounded-full border-2 ' +
    'border-[rgba(30,144,255,0.25)] border-t-[var(--color-primary)] ' +
    'animate-spin',

  // ── DIVIDERS ─────────────────────────────────────────────────────────────
  divider:
    'h-px bg-gradient-to-r from-transparent via-[rgba(30,144,255,0.25)] to-transparent my-6',

  dividerSolid:
    'h-px bg-white/5 my-4',

} as const;

// ─────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────
export type DesignTokens  = typeof DESIGN_TOKENS;
export type CommonClasses = typeof COMMON_CLASSES;

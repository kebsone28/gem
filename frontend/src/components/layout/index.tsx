import React from 'react';
import { COMMON_CLASSES } from '../../styles/tokens';
import { withAnalytics } from '../../utils/designSystemAnalytics';

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENTS – GEM SAAS
   Composants de mise en page standardisés pour toutes les pages.
   Utilisent exclusivement les CSS variables du design system Electric Blue.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────
// PAGE HEADER – En-tête standardisé avec titre, sous-titre, icône et actions
// ─────────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode | React.ComponentType<any>;
  actions?: React.ReactNode;
  className?: string;
  /** Variant visuel : 'default' = ligne de séparation, 'gradient' = fond dégradé */
  variant?: 'default' | 'gradient';
}

function renderIcon(icon?: React.ReactNode | React.ComponentType<any>) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'function') {
    const Comp = icon as React.ComponentType<any>;
    return <Comp />;
  }
  return null;
}

export const PageHeader: React.FC<PageHeaderProps> = withAnalytics(
  ({ title, subtitle, icon, actions, className = '', variant = 'default' }) => {
    if (variant === 'gradient') {
      return (
        <div className={`page-header mb-6 ${className}`}>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2.5 rounded-xl bg-white/20 text-white">{renderIcon(icon)}</div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight tracking-tight m-0">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-white/75 text-sm mt-0.5 leading-relaxed">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
          </div>
        </div>
      );
    }

    // Variant default
    return (
      <div className={`${COMMON_CLASSES.pageHeader} ${className}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {icon && (
              <div
                className="
                p-2.5 rounded-xl shrink-0
                bg-[rgba(30,144,255,0.10)] dark:bg-[rgba(30,144,255,0.15)]
                text-[var(--color-primary)] dark:text-[#60AFFF]
              "
              >
                {renderIcon(icon)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`${COMMON_CLASSES.heading1} mb-0 break-words`}>{title}</h1>
              {subtitle && (
                <p className={`${COMMON_CLASSES.body} text-sm mt-0.5 break-words`}>{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex w-full md:w-auto flex-wrap justify-start md:justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  },
  'PageHeader'
);

// ─────────────────────────────────────────────────────────────────────────
// PAGE CONTAINER – Conteneur principal avec max-width optionnel
// ─────────────────────────────────────────────────────────────────────────

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Padding interne (défaut : 'none' — chaque page gère son propre padding) */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const PageContainer: React.FC<PageContainerProps> = withAnalytics(
  ({ children, className = '', maxWidth = 'full', padding = 'none' }) => {
    const maxWidthClasses: Record<string, string> = {
      sm: 'max-w-2xl',
      md: 'max-w-4xl',
      lg: 'max-w-6xl',
      xl: 'max-w-7xl',
      '2xl': 'max-w-screen-2xl',
      full: 'max-w-full',
    };

    const paddingClasses: Record<string, string> = {
      none: '',
      sm: 'p-4 sm:p-5',
      md: 'p-4 sm:p-6 lg:p-8',
      lg: 'p-6 sm:p-8 lg:p-10',
    };

    return (
      <div
        className={[
          'w-full mx-auto',
          maxWidthClasses[maxWidth],
          paddingClasses[padding],
          className,
        ].join(' ')}
      >
        {children}
      </div>
    );
  },
  'PageContainer'
);

// ─────────────────────────────────────────────────────────────────────────
// SECTION – Bloc de contenu avec titre optionnel
// ─────────────────────────────────────────────────────────────────────────

interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  actions?: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  className = '',
  padding = 'none',
  actions,
}) => {
  const paddingClasses: Record<string, string> = {
    none: '',
    sm: 'py-4',
    md: 'py-6',
    lg: 'py-8',
  };

  return (
    <section className={`${COMMON_CLASSES.section} ${paddingClasses[padding]} ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && <h2 className={COMMON_CLASSES.heading2}>{title}</h2>}
            {subtitle && <p className={`${COMMON_CLASSES.body} mt-1`}>{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CONTENT AREA – Zone de contenu avec card stylisée
// ─────────────────────────────────────────────────────────────────────────

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Si true, ajoute un effet premium (top highlight + hover) */
  electric?: boolean;
}

export const ContentArea: React.FC<ContentAreaProps> = ({
  children,
  className = '',
  padding = 'md',
  electric = false,
}) => {
  const paddingClasses: Record<string, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={[
        COMMON_CLASSES.card,
        electric ? COMMON_CLASSES.cardHover : '',
        paddingClasses[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CARD GRID – Grille de cartes responsive
// ─────────────────────────────────────────────────────────────────────────

interface CardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className = '',
}) => {
  const gridClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses: Record<string, string> = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div className={`grid ${gridClasses[columns]} ${gapClasses[gap]} ${className}`}>{children}</div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// STATS GRID – Grille de KPI / statistiques (4 colonnes par défaut)
// ─────────────────────────────────────────────────────────────────────────

interface StatsGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ children, className = '', columns = 4 }) => {
  const gridClasses: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return <div className={`grid ${gridClasses[columns]} gap-4 ${className}`}>{children}</div>;
};

// ─────────────────────────────────────────────────────────────────────────
// SIDEBAR LAYOUT – Mise en page avec sidebar latérale interne
// ─────────────────────────────────────────────────────────────────────────

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarWidth?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Si true, le sidebar est à droite */
  reverse?: boolean;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  sidebar,
  main,
  sidebarWidth = 'md',
  className = '',
  reverse = false,
}) => {
  const widthClasses: Record<string, string> = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
  };

  return (
    <div className={`flex gap-6 ${reverse ? 'flex-row-reverse' : ''} ${className}`}>
      <aside className={`${widthClasses[sidebarWidth]} flex-shrink-0 hidden lg:block`}>
        {sidebar}
      </aside>
      <main className="flex-1 min-w-0">{main}</main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EMPTY STATE – Placeholder quand il n'y a pas de données
// ─────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucun résultat',
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      ].join(' ')}
    >
      {icon && (
        <div
          className="
          mb-4 p-4 rounded-2xl
          bg-[rgba(30,144,255,0.08)] dark:bg-[rgba(30,144,255,0.12)]
          text-[var(--color-primary)] dark:text-[#60AFFF]
        "
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-sm leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// LOADING STATE – État de chargement centré
// ─────────────────────────────────────────────────────────────────────────

interface LoadingStateProps {
  text?: string;
  minHeight?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  text = 'Chargement...',
  minHeight = 'min-h-64',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${minHeight} ${className}`}>
      <div className={COMMON_CLASSES.spinner} />
      {text && <p className={COMMON_CLASSES.caption}>{text}</p>}
    </div>
  );
};

export { default as NotificationCenter } from './NotificationCenter';

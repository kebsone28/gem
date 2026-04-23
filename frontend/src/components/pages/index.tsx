 
import React from 'react';
import { COMMON_CLASSES } from '../../styles/tokens';
import { PageHeader, PageContainer, StatsGrid, Section, LoadingState } from '../layout';

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE TEMPLATES – GEM SAAS
   Templates de page standardisés, prêts à l'emploi.
   Tous les styles utilisent le design system Electric Blue via CSS variables.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────
// STATS PAGE – Page avec header + KPIs + contenu
// ─────────────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

interface StatsPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  stats: StatItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
}

const statColorMap: Record<NonNullable<StatItem['color']>, string> = {
  blue: 'text-[var(--color-primary)] dark:text-[#60AFFF]',
  green: 'text-[var(--color-success)] dark:text-emerald-400',
  yellow: 'text-[var(--color-warning)] dark:text-amber-400',
  red: 'text-[var(--color-danger)] dark:text-red-400',
  gray: 'text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]',
};

const statIconBgMap: Record<NonNullable<StatItem['color']>, string> = {
  blue: 'bg-[rgba(30,144,255,0.10)] dark:bg-[rgba(30,144,255,0.15)] text-[var(--color-primary)]',
  green: 'bg-[rgba(16,185,129,0.10)] dark:bg-[rgba(16,185,129,0.15)] text-[var(--color-success)]',
  yellow: 'bg-[rgba(245,158,11,0.10)] dark:bg-[rgba(245,158,11,0.15)] text-[var(--color-warning)]',
  red: 'bg-[rgba(239,68,68,0.10)] dark:bg-[rgba(239,68,68,0.15)] text-[var(--color-danger)]',
  gray: 'bg-[rgba(100,116,139,0.10)] dark:bg-[rgba(100,116,139,0.15)] text-[var(--color-text-muted)]',
};

export const StatsPage: React.FC<StatsPageProps> = ({
  title,
  subtitle,
  icon,
  stats,
  actions,
  children,
  loading = false,
}) => {
  if (loading) {
    return (
      <PageContainer>
        <LoadingState minHeight="min-h-96" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />

      {/* KPI Grid */}
      {stats.length > 0 && (
        <StatsGrid className="mb-6 sm:mb-8">
          {stats.map((stat, idx) => {
            const color = stat.color ?? 'blue';
            return (
              <div
                key={idx}
                className={`${COMMON_CLASSES.card} ${COMMON_CLASSES.cardHover} p-3 sm:${COMMON_CLASSES.cardPadding} kpi-card`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`${COMMON_CLASSES.overline} mb-1 truncate sm:mb-2`}>{stat.label}</p>
                    <p className={`text-xl font-bold tracking-tighter sm:text-2xl ${statColorMap[color]}`}>
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <div
                        className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                          stat.trend.isPositive
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-danger)]'
                        }`}
                      >
                        <span>{stat.trend.isPositive ? '↑' : '↓'}</span>
                        <span>{Math.abs(stat.trend.value)}%</span>
                        <span className={`font-normal ${COMMON_CLASSES.caption}`}>
                          vs mois préc.
                        </span>
                      </div>
                    )}
                  </div>
                  {stat.icon && (
                    <div className={`rounded-xl p-2.5 shrink-0 sm:p-3 ${statIconBgMap[color]}`}>
                      {stat.icon}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </StatsGrid>
      )}

      <Section>{children}</Section>
    </PageContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// FILTER PAGE – Page avec barre de filtres + contenu filtré
// ─────────────────────────────────────────────────────────────────────────

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  filters: {
    key: string;
    label: string;
    options: FilterOption[];
    value?: string;
    onChange: (value: string) => void;
  }[];
  search?: {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  totalCount?: number;
}

export const FilterPage: React.FC<FilterPageProps> = ({
  title,
  subtitle,
  icon,
  filters,
  search,
  actions,
  children,
  loading = false,
  totalCount,
}) => {
  return (
    <PageContainer>
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />

      {/* Barre de filtres */}
      <div className={`${COMMON_CLASSES.card} ${COMMON_CLASSES.cardSm} mb-5 sm:mb-6`}>
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row">
          {/* Recherche */}
          {search && (
            <div className="flex-1">
              <div className="relative">
                <div
                  className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none
                  text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className={`${COMMON_CLASSES.input} pl-10`}
                />
              </div>
            </div>
          )}

          {/* Selects de filtre */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {filters.map((filter) => (
              <div key={filter.key} className="flex flex-col gap-1">
                <label className={COMMON_CLASSES.label}>{filter.label}</label>
                <select
                  value={filter.value ?? ''}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className={`${COMMON_CLASSES.input} w-full sm:min-w-[140px] sm:w-auto`}
                  title={filter.label}
                  aria-label={filter.label}
                >
                  <option value="">Tous</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                      {opt.count !== undefined ? ` (${opt.count})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {totalCount !== undefined && (
          <p className={`mt-3 ${COMMON_CLASSES.caption}`}>
            <span className="font-semibold text-[var(--color-primary)]">{totalCount}</span> résultat
            {totalCount !== 1 ? 's' : ''} trouvé{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Contenu */}
      {loading ? <LoadingState minHeight="min-h-96" /> : <div>{children}</div>}
    </PageContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// FORM PAGE – Page avec formulaire centré
// ─────────────────────────────────────────────────────────────────────────

interface FormPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSubmit: (data: Record<string, FormDataEntryValue>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

export const FormPage: React.FC<FormPageProps> = ({
  title,
  subtitle,
  icon,
  onSubmit,
  submitLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  onCancel,
  loading = false,
  children,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit(Object.fromEntries(formData.entries()));
  };

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title={title} subtitle={subtitle} icon={icon} />

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className={`${COMMON_CLASSES.card} ${COMMON_CLASSES.cardPadding}`}>{children}</div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`${COMMON_CLASSES.btnSecondary} w-full sm:w-auto`}
              disabled={loading}
            >
              {cancelLabel}
            </button>
          )}
          <button type="submit" className={`${COMMON_CLASSES.btnPrimary} w-full sm:w-auto`} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className={COMMON_CLASSES.spinnerSm} />
                Enregistrement...
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </PageContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// DETAIL PAGE – Page de détail avec breadcrumbs et contenu
// ─────────────────────────────────────────────────────────────────────────

interface DetailPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
}

export const DetailPage: React.FC<DetailPageProps> = ({
  title,
  subtitle,
  icon,
  breadcrumbs,
  actions,
  children,
  loading = false,
}) => {
  return (
    <PageContainer>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4" aria-label="Fil d'ariane">
          <ol className="flex items-center flex-wrap gap-1 text-xs">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-1">
                {idx > 0 && (
                  <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-[var(--color-primary)] hover:underline font-medium"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />

      {loading ? <LoadingState minHeight="min-h-96" /> : <div>{children}</div>}
    </PageContainer>
  );
};

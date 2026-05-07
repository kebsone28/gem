/* eslint-disable no-inline-styles */
 
import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export const DASHBOARD_STICKY_PANEL =
  'sticky top-2 z-20 -mx-1 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(10,16,28,0.94))] px-4 py-4 shadow-[0_20px_50px_rgba(2,6,23,0.5)] backdrop-blur-xl sm:mx-0 sm:px-5';

export const DASHBOARD_ACTION_TILE =
  'min-h-[72px] rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98]';

export const DASHBOARD_ACTION_TILE_SECONDARY =
  `${DASHBOARD_ACTION_TILE} border-white/10 bg-white/[0.03] text-slate-100 hover:border-white/14 hover:bg-white/[0.06]`;

export const DASHBOARD_ACTION_TILE_PRIMARY =
  `${DASHBOARD_ACTION_TILE} border-blue-500/30 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500`;

export const DASHBOARD_MINI_STAT_CARD =
  'min-w-[170px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const DASHBOARD_SECTION_SURFACE =
  'rounded-[1.6rem] sm:rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(10,15,28,0.86))] shadow-[0_24px_70px_rgba(2,6,23,0.35)] backdrop-blur-2xl';

export const DASHBOARD_PRIMARY_BUTTON =
  'flex h-12 items-center justify-center gap-3 rounded-2xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 active:scale-[0.98]';

export const DASHBOARD_ACCENT_SURFACE = {
  blue: 'border-blue-500/18 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(15,23,42,0.82))]',
  emerald:
    'border-emerald-500/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.82))]',
  amber:
    'border-amber-500/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.82))]',
  violet:
    'border-violet-500/18 bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(15,23,42,0.82))]',
} as const;

export const MODULE_ACCENTS = {
  terrain: {
    surface: DASHBOARD_ACCENT_SURFACE.emerald,
    text: 'text-emerald-300',
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    primaryButton: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
    softRing: 'focus:ring-emerald-500/15',
    softBorder: 'focus:border-emerald-400/35',
  },
  planning: {
    surface: DASHBOARD_ACCENT_SURFACE.violet,
    text: 'text-violet-300',
    badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    primaryButton: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25',
    softRing: 'focus:ring-violet-500/15',
    softBorder: 'focus:border-violet-400/35',
  },
  logistique: {
    surface: DASHBOARD_ACCENT_SURFACE.amber,
    text: 'text-amber-300',
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    primaryButton: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25 text-slate-950',
    softRing: 'focus:ring-amber-500/15',
    softBorder: 'focus:border-amber-400/35',
  },
  reports: {
    surface: DASHBOARD_ACCENT_SURFACE.blue,
    text: 'text-cyan-300',
    badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    primaryButton: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25',
    softRing: 'focus:ring-cyan-500/15',
    softBorder: 'focus:border-cyan-400/35',
  },
  simulation: {
    surface: DASHBOARD_ACCENT_SURFACE.violet,
    text: 'text-violet-300',
    badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    primaryButton: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25',
    softRing: 'focus:ring-violet-500/15',
    softBorder: 'focus:border-violet-400/35',
  },
  bordereau: {
    surface: DASHBOARD_ACCENT_SURFACE.emerald,
    text: 'text-emerald-300',
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    primaryButton: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
    softRing: 'focus:ring-emerald-500/15',
    softBorder: 'focus:border-emerald-400/35',
  },
  formation: {
    surface: DASHBOARD_ACCENT_SURFACE.blue,
    text: 'text-blue-300',
    badge: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    primaryButton: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25',
    softRing: 'focus:ring-blue-500/15',
    softBorder: 'focus:border-blue-400/35',
  },
} as const;

export const DASHBOARD_INPUT =
  'h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/35 focus:bg-white/[0.07]';

export const DASHBOARD_TEXTAREA =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/35 focus:bg-white/[0.07]';

export const DASHBOARD_TABLE_SHELL =
  'overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_18px_45px_rgba(2,6,23,0.2)]';

export const DASHBOARD_TABLE_HEAD_ROW =
  'border-b border-white/8 bg-white/[0.04] text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400';

export const DASHBOARD_TABLE_ROW =
  'border-b border-white/6 transition-colors hover:bg-white/[0.03]';

type ModuleAccentKey = keyof typeof MODULE_ACCENTS;

interface ModulePageShellProps {
  accent: ModuleAccentKey;
  children: React.ReactNode;
  className?: string;
}

export const ModulePageShell: React.FC<ModulePageShellProps> = ({
  accent,
  children,
  className = '',
}) => (
  <div
    className={[
      DASHBOARD_SECTION_SURFACE,
      MODULE_ACCENTS[accent].surface,
      'p-4 sm:p-6 lg:p-8',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);

/* ─────────────────────────────────────────────
   STATUS BADGE
   Premium Glow Version
 ───────────────────────────────────────────── */
type StatusType = 'success' | 'warning' | 'danger' | 'info';

export const StatusBadge: React.FC<{ status: StatusType; label?: string }> = ({
  status,
  label,
}) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5',
  };

  const icons = {
    success: <CheckCircle2 size={12} />,
    warning: <AlertTriangle size={12} />,
    danger: <AlertCircle size={12} />,
    info: <Info size={12} />,
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md ${styles[status]}`}
    >
      <span className="opacity-80">{icons[status]}</span>
      {label || status}
    </div>
  );
};

/* ─────────────────────────────────────────────
   PROGRESS BAR
   Gradient & Glow Version
 ───────────────────────────────────────────── */
interface ProgressBarProps {
  label: string;
  count?: string;
  percentage: number;
  status?: StatusType;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  count,
  percentage,
  status = 'info',
}) => {
  const barColors = {
    success: 'from-emerald-600 to-emerald-400 shadow-emerald-500/40',
    warning: 'from-amber-600 to-amber-400 shadow-amber-500/40',
    danger: 'from-rose-600 to-rose-400 shadow-rose-500/40',
    info: 'from-blue-700 to-blue-400 shadow-blue-600/40',
  };

  return (
    <div className="w-full space-y-2.5 py-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <span className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] leading-tight text-blue-200/60">
          {label}
        </span>
        <div className="shrink-0 text-right">
          <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
            {percentage}%
          </span>
          {count && (
              <span className="ml-1.5 hidden text-[9px] font-semibold uppercase tracking-[0.1em] leading-none text-white/35 sm:inline">
              [{count}]
            </span>
          )}
        </div>
      </div>
      <div className="h-2 sm:h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner p-[1px]">
        <div
          className={`h-full transition-all duration-1000 ease-out rounded-full bg-gradient-to-r shadow-[0_0_15px] w-[var(--progress)] ${barColors[status]}`}
          style={{ '--progress': `${percentage}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   KPI CARD
   Glassmorphism & Depth Version
 ───────────────────────────────────────────── */
interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isUp: boolean;
    label: string;
  };
  sparkline?: number[];
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon, trend, sparkline }) => {
  return (
    <div className={`${DASHBOARD_SECTION_SURFACE} group relative min-h-[142px] overflow-hidden p-4 transition-all hover:bg-white/[0.04] hover:shadow-blue-500/10 sm:min-h-[208px] sm:p-6 lg:rounded-[2.5rem] lg:p-8`}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-600/5 blur-[50px] rounded-full group-hover:bg-blue-600/10 transition-all duration-700" />

      <div className="flex justify-between items-start gap-3 mb-4 sm:mb-6 relative z-10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-blue-300 shadow-lg transition-all duration-500 group-hover:border-blue-400 group-hover:bg-blue-600 group-hover:text-white sm:h-12 sm:w-12 sm:rounded-2xl sm:group-hover:scale-110 lg:h-14 lg:w-14">
          {icon}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold tracking-[0.12em] uppercase ${trend.isUp ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'}`}
          >
            {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="relative z-10 flex min-h-[68px] flex-col justify-between">
        <h3 className="mb-2 max-w-full break-words text-[9px] font-semibold uppercase leading-[1.04] tracking-[0.08em] text-slate-300 sm:mb-3 sm:text-[10px] lg:text-[11px]">
          {title}
        </h3>
        <p className="text-[2rem] font-black leading-none tracking-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl">
          {value}
        </p>

        {trend && (
          <p className="mt-2 text-[9px] font-medium uppercase leading-tight tracking-[0.1em] text-slate-400 sm:mt-3">
            {trend.label}
          </p>
        )}
      </div>

      {/* Visual Flair Background Icon */}
      <div className="absolute -bottom-6 -right-6 hidden lg:block opacity-[0.02] text-white scale-[4] pointer-events-none group-hover:opacity-[0.05] group-hover:rotate-12 transition-all duration-700">
        {icon}
      </div>

      {sparkline && (
        <div className="mt-8 hidden sm:flex lg:mt-10 h-10 lg:h-12 items-end gap-1 opacity-[0.08] group-hover:opacity-30 transition-all duration-500">
          {sparkline.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500/60 rounded-t-md transition-all duration-1000 h-[var(--bar-h)]"
              style={{ '--bar-h': `${h}%` } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   ACTION BAR
 ───────────────────────────────────────────── */
interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({ children, className = '' }) => (
  <div
    className={`flex flex-col items-stretch gap-3 rounded-[1.5rem] border border-white/6 bg-white/[0.04] p-3 shadow-inner backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center sm:p-4 ${className}`}
  >
    {children}
  </div>
);

/* ─────────────────────────────────────────────
   ACTIVITY FEED
 ───────────────────────────────────────────── */
interface Activity {
  id: string;
  type: StatusType;
  message: string;
  time: string;
}

export const ActivityFeed: React.FC<{ activities: Activity[] }> = ({ activities }) => (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-3 px-1 sm:px-2">
      <h3 className="text-[10px] sm:text-[10px] font-black text-blue-300/55 uppercase tracking-[0.06em] sm:tracking-[0.18em]">
        ACTIVITÉ EN TEMPS RÉEL
      </h3>
      <button className="hidden sm:flex text-[10px] font-black text-blue-400 items-center gap-1.5 hover:text-white tracking-[0.08em] uppercase transition-colors">
        JOURNAL COMPLET <ArrowRight size={12} />
      </button>
    </div>
    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
      {activities.length > 0 ? (
        activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-4 sm:gap-6 items-start p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-white/5 transition-all group border border-transparent hover:border-white/5 active:scale-[0.98]"
          >
            <div
              className={`mt-2 w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_10px] ${
                activity.type === 'success'
                  ? 'bg-emerald-500 shadow-emerald-500/50'
                  : activity.type === 'warning'
                    ? 'bg-amber-500 shadow-amber-500/50'
                    : activity.type === 'danger'
                      ? 'bg-rose-500 shadow-rose-500/50'
                      : 'bg-blue-600 shadow-blue-600/50'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] sm:text-[13px] font-bold text-slate-300 leading-relaxed group-hover:text-white transition-colors">
                {activity.message}
              </p>
              <p className="text-[9px] sm:text-[9px] text-blue-500/60 font-black mt-2 tracking-[0.04em] sm:tracking-[0.08em] uppercase group-hover:text-blue-400">
                {activity.time}
              </p>
            </div>
          </div>
        ))
      ) : (
        <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-center">
          <ActivityCircle size={40} className="mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">
            Aucune activité enregistrée
          </p>
        </div>
      )}
    </div>
  </div>
);

const ActivityCircle: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

/* ─────────────────────────────────────────────
   ALERT PANEL
 ───────────────────────────────────────────── */
export const AlertPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4">
    <h3 className="text-[11px] font-black text-rose-400/70 uppercase tracking-[0.08em] mb-6">
      ALERTES CRITIQUES
    </h3>
    {children}
  </div>
);

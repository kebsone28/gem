/* eslint-disable no-inline-styles */
 
import React from 'react';
import { motion } from 'framer-motion';
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
    success: 'from-emerald-600 via-emerald-400 to-emerald-300 shadow-emerald-500/30',
    warning: 'from-amber-600 via-amber-400 to-amber-300 shadow-amber-500/30',
    danger: 'from-rose-600 via-rose-400 to-rose-300 shadow-rose-500/30',
    info: 'from-blue-700 via-blue-500 to-cyan-400 shadow-blue-600/30',
  };

  return (
    <div className="w-full space-y-3 py-3 group">
      <div className="flex items-end justify-between gap-3 px-1.5">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-400 transition-colors">
            {label}
          </span>
          {count && (
            <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-widest">
              Volume: {count}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-black text-white tracking-tighter"
          >
            {percentage}
          </motion.span>
          <span className="text-[10px] font-black text-slate-500">%</span>
        </div>
      </div>
      <div className="relative h-3 w-full bg-slate-950/50 rounded-full border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] overflow-hidden p-[2px]">
        {/* Track shine */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
        
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full bg-gradient-to-r shadow-[0_0_15px] relative overflow-hidden ${barColors[status]}`}
        >
          {/* Animated glow pulse */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-[shimmer_2s_infinite] -translate-x-full" />
        </motion.div>
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
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className={`${DASHBOARD_SECTION_SURFACE} group relative min-h-[142px] overflow-hidden p-5 transition-all hover:bg-white/[0.05] hover:shadow-[0_20px_50px_rgba(37,99,235,0.15)] sm:min-h-[210px] sm:p-7 lg:rounded-[2.8rem] lg:p-9`}
    >
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-700" 
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} 
      />
      
      {/* Advanced Glow Effect */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full group-hover:bg-blue-400/20 group-hover:scale-125 transition-all duration-1000" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full group-hover:bg-indigo-400/10 transition-all duration-1000" />

      <div className="flex justify-between items-start gap-4 mb-6 sm:mb-8 relative z-10">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] text-blue-400 shadow-[0_10px_20px_rgba(0,0,0,0.2)] transition-all duration-500 group-hover:scale-110 group-hover:border-blue-400/50 group-hover:text-blue-300 sm:h-14 sm:w-14 sm:rounded-[1.25rem] lg:h-16 lg:w-16">
          {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: 2.5 })}
        </div>
        {trend && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[0.1em] uppercase shadow-lg backdrop-blur-md ${trend.isUp ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}
          >
            {trend.isUp ? <TrendingUp size={14} strokeWidth={3} /> : <TrendingDown size={14} strokeWidth={3} />}
            {trend.value}%
          </motion.div>
        )}
      </div>

      <div className="relative z-10 flex flex-col">
        <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-400 transition-colors sm:text-[11px]">
          {title}
        </h3>
        <div className="flex items-baseline gap-2">
          <p className="text-[2.2rem] font-black leading-none tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
            {value}
          </p>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-2 sm:mt-5">
            <div className={`h-1 w-8 rounded-full ${trend.isUp ? 'bg-emerald-500' : 'bg-rose-500'} opacity-30`} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-300 transition-colors">
              {trend.label}
            </p>
          </div>
        )}
      </div>

      {sparkline && (
        <div className="mt-8 flex h-12 items-end gap-1.5 opacity-20 group-hover:opacity-60 transition-all duration-700">
          {sparkline.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05, duration: 0.8 }}
              className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-sm shadow-[0_0_10px_rgba(59,130,246,0.3)]"
            />
          ))}
        </div>
      )}

      {/* Decorative background icon */}
      <div className="absolute -bottom-10 -right-10 opacity-[0.03] text-white scale-[5] pointer-events-none group-hover:opacity-[0.07] group-hover:rotate-12 group-hover:scale-[5.5] transition-all duration-1000 ease-out">
        {icon}
      </div>
    </motion.div>
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

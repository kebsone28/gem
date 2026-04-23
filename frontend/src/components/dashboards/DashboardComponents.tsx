 
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] italic shadow-lg backdrop-blur-md ${styles[status]}`}
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
        <span className="min-w-0 text-[9px] sm:text-[10px] font-black text-blue-300/30 uppercase tracking-[0.18em] sm:tracking-[0.25em] italic leading-tight">
          {label}
        </span>
        <div className="shrink-0 text-right">
          <span className="text-xs sm:text-sm font-black text-white italic tracking-tighter">
            {percentage}%
          </span>
          {count && (
            <span className="ml-1.5 hidden text-[8px] text-white/20 font-black uppercase tracking-[0.18em] leading-none sm:inline">
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
    <div className="bg-slate-900/40 backdrop-blur-xl p-4 sm:p-6 lg:p-8 rounded-[1.6rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-white/10 hover:bg-white/[0.07] transition-all group relative overflow-hidden shadow-xl sm:shadow-2xl hover:shadow-blue-500/10 min-h-[168px] sm:min-h-[208px]">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[60px] rounded-full group-hover:bg-blue-600/10 transition-all duration-700" />

      <div className="flex justify-between items-start gap-3 mb-5 sm:mb-6 relative z-10">
        <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white/5 rounded-xl sm:rounded-2xl group-hover:bg-blue-600 text-blue-400 group-hover:text-white transition-all duration-500 flex items-center justify-center border border-white/5 group-hover:border-blue-400 group-hover:scale-110 shadow-lg shrink-0">
          {icon}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[8px] sm:text-[9px] lg:text-[10px] font-black tracking-[0.12em] sm:tracking-widest italic px-2 py-1 rounded-lg border ${trend.isUp ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'}`}
          >
            {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="relative z-10">
        <h3 className="text-[8px] sm:text-[9px] lg:text-[10px] font-black text-blue-300/30 uppercase tracking-[0.18em] sm:tracking-[0.28em] lg:tracking-[0.4em] mb-2 sm:mb-3 italic leading-tight">
          {title}
        </h3>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tighter italic leading-none drop-shadow-md">
          {value}
        </p>

        {trend && (
          <p className="text-[8px] sm:text-[9px] text-blue-300/20 font-black mt-2 sm:mt-3 uppercase tracking-[0.12em] sm:tracking-widest italic leading-tight">
            {trend.label}
          </p>
        )}
      </div>

      {/* Visual Flair Background Icon */}
      <div className="absolute -bottom-8 -right-8 opacity-[0.02] text-white scale-[4] pointer-events-none group-hover:opacity-[0.05] group-hover:rotate-12 transition-all duration-700">
        {icon}
      </div>

      {sparkline && (
        <div className="mt-6 sm:mt-8 lg:mt-10 h-8 sm:h-10 lg:h-12 flex items-end gap-1 opacity-10 group-hover:opacity-40 transition-all duration-500">
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
    className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center bg-white/5 p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2.2rem] border border-white/5 shadow-inner backdrop-blur-md ${className}`}
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
      <h3 className="text-[9px] sm:text-[10px] font-black text-blue-300/30 uppercase tracking-[0.22em] sm:tracking-[0.4em] italic">
        ACTIVITÉ EN TEMPS RÉEL
      </h3>
      <button className="hidden sm:flex text-[10px] font-black text-blue-400 items-center gap-1.5 hover:text-white tracking-widest uppercase italic transition-colors">
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
              <p className="text-[8px] sm:text-[9px] text-blue-500/60 font-black mt-2 tracking-[0.14em] sm:tracking-[0.2em] uppercase italic group-hover:text-blue-400">
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
    <h3 className="text-[11px] font-black text-rose-400/50 uppercase tracking-[0.4em] mb-6 italic">
      ALERTES CRITIQUES
    </h3>
    {children}
  </div>
);

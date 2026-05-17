
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  Activity,
  ShieldCheck,
  Users,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { getMissionReadiness } from '../../services/missionValidation';
import { verifyIntegrity } from '../../utils/crypto';
import type { MissionOrderData, MissionMember } from '../../pages/mission/core/missionTypes';

interface MissionStatusWidgetProps {
  data?: Partial<MissionOrderData>;
  members?: MissionMember[];
  isCertified?: boolean;
  isSubmitted?: boolean;
  isSyncing?: boolean;
  lastSync?: string;
  version?: number;
  isDirty?: boolean;
  healthScore?: number;
  healthStatus?: 'optimal' | 'warning' | 'critical';
  budgetVariance?: number;
}

export const MissionStatusWidget: React.FC<MissionStatusWidgetProps> = ({
  data = {},
  members = [],
  isCertified = false,
  isSubmitted = false,
  isSyncing = false,
  lastSync = 'Jamais',
  version = 1,
  isDirty = false,
  healthScore = 100,
  healthStatus = 'optimal',
  budgetVariance = 0,
}) => {
  const [isIntegrityValid, setIsIntegrityValid] = React.useState<boolean | null>(null);

  const hasOfficialNumber = data.orderNumber && !data.orderNumber.startsWith('TEMP-');
  const effectiveCertified = isCertified || hasOfficialNumber;

  React.useEffect(() => {
    if (data.integrityHash) {
      verifyIntegrity({ formData: data, members, version }, data.integrityHash).then((v) =>
        setIsIntegrityValid(v)
      );
    } else {
      setIsIntegrityValid(null);
    }
  }, [data, members, version]);

  const { percentage, status, nextSteps } = getMissionReadiness(
    data,
    members,
    effectiveCertified as boolean,
    isSubmitted
  );

  const displayPct = effectiveCertified ? 100 : Math.round(percentage);

  /* ─ Status → visual config ─ */
  const statusCfg: Record<string, { label: string; color: string; dot: string; bar: string; glow: string }> = {
    draft:     { label: 'Brouillon',  color: 'text-slate-400',   dot: 'bg-slate-500',   bar: 'bg-slate-500',   glow: 'from-slate-500/0' },
    ready:     { label: 'Prêt',       color: 'text-indigo-400',  dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  glow: 'from-indigo-500/10' },
    submitted: { label: 'Soumise',    color: 'text-amber-400',   dot: 'bg-amber-500',   bar: 'bg-amber-400',   glow: 'from-amber-500/10' },
    certified: { label: 'Officielle', color: 'text-emerald-400', dot: 'bg-emerald-500', bar: 'bg-emerald-500', glow: 'from-emerald-500/10' },
    executed:  { label: 'Exécutée',  color: 'text-teal-400',    dot: 'bg-teal-400',    bar: 'bg-teal-400',    glow: 'from-teal-500/10' },
  };

  const healthCfg = {
    optimal:  { text: 'text-emerald-400', bar: 'bg-emerald-500', bg: 'bg-emerald-500/8 border-emerald-500/15', label: 'Optimal' },
    warning:  { text: 'text-amber-400',   bar: 'bg-amber-400',   bg: 'bg-amber-500/8 border-amber-500/15',     label: 'Vigilance' },
    critical: { text: 'text-rose-400',    bar: 'bg-rose-500',    bg: 'bg-rose-500/8 border-rose-500/15',       label: 'Critique' },
  }[healthStatus];

  const cfg = statusCfg[status] || statusCfg.draft;
  const totalIndemnites = members.reduce((s, m) => s + (m.dailyIndemnity || 0) * (m.days || 1), 0);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0d1117] border border-white/[0.07] p-4 space-y-3.5">
      {/* Ambient glow */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-radial ${cfg.glow} to-transparent blur-3xl pointer-events-none rounded-full`} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          {isSyncing
            ? <RefreshCw size={9} className="text-indigo-400 animate-spin" />
            : <span className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'}`} />
          }
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
            {isSyncing ? 'Sync…' : isDirty ? 'Modifié' : 'Synchronisé'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* ── Progress Ring + label ── */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${healthCfg.bg} relative z-10`}>
        {/* Circular mini-ring */}
        <div className="relative w-10 h-10 shrink-0">
          <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(displayPct / 100) * 87.96} 87.96`}
              className={healthCfg.text}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black ${healthCfg.text}`}>
            {displayPct}%
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Préparation</span>
            <span className={`text-[9px] font-black ${healthCfg.text}`}>{healthCfg.label}</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${healthCfg.bar} mission-status-bar`}
              style={{ '--status-width': `${displayPct}%` } as React.CSSProperties}
            />
          </div>
        </div>
        <Activity size={12} className={`${healthCfg.text} shrink-0`} />
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Users size={9} className="text-slate-600" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Effectif</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[18px] font-black text-white leading-none">{members.length}</span>
            <span className="text-[8px] text-slate-500 font-bold">pers.</span>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Zap size={9} className={budgetVariance > 10 ? 'text-rose-500' : 'text-emerald-500'} />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Indem.</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-black text-white leading-none font-mono">
              {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(totalIndemnites)}
            </span>
            <span className="text-[7px] text-slate-500 font-bold">XOF</span>
          </div>
        </div>
      </div>

      {/* ── Integrity badge ── */}
      {isIntegrityValid !== null && (
        <div
          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border relative z-10 ${
            isIntegrityValid
              ? 'bg-indigo-500/6 border-indigo-500/15'
              : 'bg-rose-500/8 border-rose-500/20'
          }`}
        >
          <ShieldCheck size={10} className={isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'} />
          <span className={`text-[8px] font-black uppercase tracking-widest ${isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'}`}>
            {isIntegrityValid ? 'Intégrité vérifiée' : 'Données altérées'}
          </span>
        </div>
      )}

      {/* ── Next steps checklist ── */}
      {nextSteps.length > 0 && (
        <div className="border-t border-white/[0.05] pt-3 space-y-1.5 relative z-10">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={9} className="text-amber-400" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">À compléter</span>
          </div>
          {nextSteps.slice(0, 3).map((step: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 rounded-full border border-white/10 flex items-center justify-center shrink-0 mt-[1px]">
                <Clock size={7} className="text-slate-500" />
              </div>
              <span className="text-[9px] text-slate-500 font-medium leading-tight">{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer: version + last sync ── */}
      <div className="flex justify-between items-center pt-2 border-t border-white/[0.05] relative z-10">
        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">V{version}</span>
        <span className="text-[8px] text-slate-700 font-medium truncate max-w-[110px]">{lastSync}</span>
      </div>
    </div>
  );
};


/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Clock,
  Zap,
  RefreshCw,
  Activity,
  ShieldCheck,
  Users,
  AlertTriangle,
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

  /* ─ Status visual config ─ */
  const statusCfg: Record<string, { label: string; color: string; dot: string; glowClass: string }> = {
    draft:     { label: 'Brouillon',  color: 'text-slate-400',   dot: 'bg-slate-500',   glowClass: '' },
    ready:     { label: 'Prêt',       color: 'text-indigo-400',  dot: 'bg-indigo-500',  glowClass: 'shadow-indigo-500/30' },
    submitted: { label: 'Soumise',    color: 'text-amber-400',   dot: 'bg-amber-500',   glowClass: 'shadow-amber-500/30' },
    certified: { label: 'Officielle', color: 'text-emerald-400', dot: 'bg-emerald-500', glowClass: 'shadow-emerald-500/30' },
    executed:  { label: 'Exécutée',  color: 'text-teal-400',    dot: 'bg-teal-400',    glowClass: 'shadow-teal-500/30' },
  };

  /* ─ Health colour based purely on percentage ─ */
  const barColor = displayPct >= 80 ? 'bg-emerald-500' : displayPct >= 40 ? 'bg-amber-400' : 'bg-rose-500';
  const pctColor = displayPct >= 80 ? 'text-emerald-400' : displayPct >= 40 ? 'text-amber-400' : 'text-rose-400';

  const cfg = statusCfg[status] || statusCfg.draft;
  const totalIndemnites = members.reduce((s, m) => s + (m.dailyIndemnity || 0) * (m.days || 1), 0);

  return (
    <div className="rounded-2xl bg-[#0d1117] border border-white/[0.07] p-3.5 space-y-3 relative overflow-hidden">
      {/* Faint corner glow — only for non-draft */}
      {status !== 'draft' && (
        <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none ${cfg.dot}`} />
      )}

      {/* ── Row 1 : sync status + mission status ── */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          {isSyncing
            ? <RefreshCw size={9} className="text-indigo-400 animate-spin" />
            : <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${isDirty ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          }
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">
            {isSyncing ? 'Sync…' : isDirty ? 'Modifié' : 'Synchronisé'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-[8px] font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* ── Row 2 : Préparation progress bar (full width, stacked) ── */}
      <div className="bg-white/[0.04] border border-white/[0.05] rounded-xl p-2.5 space-y-1.5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity size={10} className={pctColor} />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Préparation</span>
          </div>
          <span className={`text-[13px] font-black leading-none ${pctColor}`}>{displayPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor} mission-status-bar`}
            style={{ '--status-width': `${displayPct}%` } as React.CSSProperties}
          />
        </div>
      </div>

      {/* ── Row 3 : KPI tiles ── */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-2.5 py-2">
          <div className="flex items-center gap-1 mb-1">
            <Users size={8} className="text-slate-700" />
            <span className="text-[7px] font-black uppercase tracking-widest text-slate-700">Effectif</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[17px] font-black text-white leading-none">{members.length}</span>
            <span className="text-[7px] text-slate-600 font-bold">pers.</span>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-2.5 py-2">
          <div className="flex items-center gap-1 mb-1">
            <Zap size={8} className={budgetVariance > 10 ? 'text-rose-500' : 'text-emerald-500'} />
            <span className="text-[7px] font-black uppercase tracking-widest text-slate-700">Indem.</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[11px] font-black text-white leading-none font-mono">
              {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(totalIndemnites)}
            </span>
            <span className="text-[7px] text-slate-600 font-bold">XOF</span>
          </div>
        </div>
      </div>

      {/* ── Integrity badge (only if hash present) ── */}
      {isIntegrityValid !== null && (
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border relative z-10 ${
          isIntegrityValid ? 'bg-indigo-500/6 border-indigo-500/15' : 'bg-rose-500/8 border-rose-500/20'
        }`}>
          <ShieldCheck size={9} className={isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'} />
          <span className={`text-[7px] font-black uppercase tracking-widest ${isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'}`}>
            {isIntegrityValid ? 'Intégrité vérifiée' : 'Données altérées'}
          </span>
        </div>
      )}

      {/* ── Next steps ── */}
      {nextSteps.length > 0 && (
        <div className="border-t border-white/[0.05] pt-2.5 space-y-1.5 relative z-10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={8} className="text-amber-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">À compléter</span>
          </div>
          {nextSteps.slice(0, 3).map((step: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full border border-white/10 flex items-center justify-center shrink-0 mt-[1px]">
                <Clock size={6} className="text-slate-600" />
              </div>
              <span className="text-[8px] text-slate-500 font-medium leading-tight">{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex justify-between items-center pt-2 border-t border-white/[0.05] relative z-10">
        <span className="text-[7px] font-black text-slate-800 uppercase tracking-widest">V{version}</span>
        <span className="text-[7px] text-slate-800 font-medium truncate max-w-[110px]">{lastSync}</span>
      </div>
    </div>
  );
};

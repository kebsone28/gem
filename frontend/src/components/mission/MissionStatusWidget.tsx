
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
      verifyIntegrity({ formData: data, members, version }, data.integrityHash).then(isValid => {
        setIsIntegrityValid(isValid);
      });
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

  const statusConfig: Record<string, { label: string; color: string; dot: string; glow: string }> = {
    draft:     { label: 'Brouillon', color: 'text-slate-400',  dot: 'bg-slate-500',   glow: 'bg-slate-500/10' },
    ready:     { label: 'Prêt',      color: 'text-indigo-400', dot: 'bg-indigo-500',  glow: 'bg-indigo-500/10' },
    submitted: { label: 'Soumise',   color: 'text-amber-400',  dot: 'bg-amber-500',   glow: 'bg-amber-500/10' },
    certified: { label: 'Officielle',color: 'text-emerald-400',dot: 'bg-emerald-500', glow: 'bg-emerald-500/10' },
    executed:  { label: 'Exécutée', color: 'text-emerald-400', dot: 'bg-emerald-400', glow: 'bg-emerald-500/10' },
  };

  const healthColors = {
    optimal:  { text: 'text-emerald-400', bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', label: 'Optimal' },
    warning:  { text: 'text-amber-400',   bar: 'bg-amber-400',   bg: 'bg-amber-500/10',   label: 'Vigilance' },
    critical: { text: 'text-rose-400',    bar: 'bg-rose-500',    bg: 'bg-rose-500/10',     label: 'Critique' },
  }[healthStatus];

  const cfg = statusConfig[status] || statusConfig.draft;
  const totalIndemnites = members.reduce((s, m) => s + (m.dailyIndemnity || 0) * (m.days || 1), 0);

  return (
    <div className="glass-card !p-4 !rounded-2xl space-y-3 relative overflow-hidden">
      {/* Glow */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 ${cfg.glow} blur-3xl rounded-full pointer-events-none`} />

      {/* Header : sync + statut */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          {isSyncing
            ? <RefreshCw size={10} className="text-indigo-400 animate-spin" />
            : <span className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          }
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {isSyncing ? 'Sync…' : isDirty ? 'Modifié' : 'Synchronisé'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Health Score compact */}
      <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${healthColors.bg} relative z-10`}>
        <div className="flex-1">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Préparation</span>
            <span className={`text-sm font-black ${healthColors.text}`}>
              {effectiveCertified ? 100 : percentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-1 bg-slate-800/30 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${healthColors.bar} mission-status-bar`}
              style={{ '--status-width': `${effectiveCertified ? 100 : percentage}%` } as React.CSSProperties}
            />
          </div>
        </div>
        <Activity size={14} className={`${healthColors.text} flex-shrink-0`} />
      </div>

      {/* KPIs inline */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        <div className="px-3 py-2 bg-slate-50 dark:bg-white/4 rounded-xl">
          <div className="flex items-center gap-1 mb-0.5">
            <Users size={9} className="text-slate-400" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Effectif</span>
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white">{members.length}</span>
          <span className="text-[8px] text-slate-400 font-bold ml-1">pers.</span>
        </div>
        <div className="px-3 py-2 bg-slate-50 dark:bg-white/4 rounded-xl">
          <div className="flex items-center gap-1 mb-0.5">
            <Zap size={9} className={budgetVariance > 10 ? 'text-rose-400' : 'text-emerald-400'} />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Indem.</span>
          </div>
          <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">
            {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(totalIndemnites)}
          </span>
          <span className="text-[7px] text-slate-400 font-bold ml-1">XOF</span>
        </div>
      </div>

      {/* Intégrité */}
      {isIntegrityValid !== null && (
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-dashed relative z-10 ${
          isIntegrityValid ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-rose-500/8 border-rose-500/20'
        }`}>
          <ShieldCheck size={10} className={isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'} />
          <span className={`text-[8px] font-black uppercase tracking-widest ${isIntegrityValid ? 'text-indigo-400' : 'text-rose-400'}`}>
            {isIntegrityValid ? 'Intégrité OK' : 'Données altérées'}
          </span>
        </div>
      )}

      {/* Checklist préparation */}
      {nextSteps.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1 relative z-10">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={9} className="text-amber-400" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">À compléter</span>
          </div>
          {nextSteps.slice(0, 2).map((step: string, i: number) => (
            <div key={i} className="flex items-start gap-1.5">
              <Clock size={8} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight">{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Version + dernière sync */}
      <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-white/5 relative z-10">
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">v{version}</span>
        <span className="text-[8px] text-slate-500 truncate max-w-[100px]">{lastSync}</span>
      </div>
    </div>
  );
};

import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  Database,
  Activity,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
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

  const hasOfficialNumber = data.orderNumber && !data.orderNumber.includes('TEMP');
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

  const statusConfig: Record<
    string,
    { label: string; color: string; icon: React.ElementType; bgGlow: string }
  > = {
    draft: {
      label: 'BROUILLON',
      color: 'bg-slate-500',
      icon: Clock,
      bgGlow: 'bg-slate-500/10',
    },
    ready: {
      label: 'BROUILLON',
      color: 'bg-indigo-500',
      icon: Clock,
      bgGlow: 'bg-indigo-500/10',
    },
    certified: {
      label: 'SIGNÉE',
      color: 'bg-indigo-600',
      icon: CheckCircle2,
      bgGlow: 'bg-indigo-500/10',
    },
    submitted: {
      label: 'EN ATTENTE',
      color: 'bg-amber-500',
      icon: Clock,
      bgGlow: 'bg-amber-500/10',
    },
    executed: {
      label: 'EXÉCUTÉE',
      color: 'bg-emerald-500',
      icon: CheckCircle2,
      bgGlow: 'bg-emerald-500/10',
    },
  };

  const healthUI = {
    optimal: {
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: 'Optimal',
    },
    warning: {
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: 'Vigilance',
    },
    critical: {
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      label: 'Critique',
    },
  }[healthStatus];

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <div className="glass-card !p-5 !rounded-[1.5rem] space-y-5 relative overflow-hidden group">
      {/* Background Glow */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${config.bgGlow} filter blur-3xl rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110`}
      />

      {/* Sync Status Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database size={12} className={isDirty ? 'text-amber-500' : 'text-emerald-500'} />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
            {isDirty ? 'Modifié' : 'Synchronisé'}
          </span>
        </div>
        {isSyncing && <RefreshCw size={12} className="text-indigo-500 animate-spin" />}
      </div>

      {/* Integrity Badge (Phase 4) */}
      {isIntegrityValid !== null && (
        <div className={`p-2 rounded-xl flex items-center justify-between gap-3 ${isIntegrityValid ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-rose-500/10 border-rose-500/20'} border border-dashed`}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} className={isIntegrityValid ? 'text-indigo-500' : 'text-rose-500'} />
            <span className={`text-[8px] font-black uppercase tracking-widest ${isIntegrityValid ? 'text-indigo-500' : 'text-rose-500'}`}>
              {isIntegrityValid ? 'Intégrité Certifiée' : 'Données Altérées'}
            </span>
          </div>
          {isIntegrityValid && <Zap size={8} className="text-indigo-500 animate-pulse" />}
        </div>
      )}

      {/* Health Score Central KPI */}
      <div
        className={`p-3 rounded-[1.5rem] ${healthUI.bg} ${healthUI.border} border border-dashed flex flex-col items-center justify-center relative overflow-hidden`}
      >
        <div className="absolute top-2 right-3">
          <Activity size={12} className={healthUI.color} />
        </div>
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">
          Health Score
        </span>
        <div className={`text-3xl font-black ${healthUI.color} tracking-tighter`}>
          {healthScore}
          <span className="text-xs opacity-50 ml-0.5">%</span>
        </div>
        <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${healthUI.color}`}>
          Performance : {healthUI.label}
        </span>
      </div>

      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Certification
          </h4>
          <span className="text-[8px] font-bold text-slate-500 uppercase">
            v{version} • {lastSync}
          </span>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-500/10 ${config.color}`}
        >
          {config.label}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            Préparation
          </span>
          <span className="text-[11px] font-black text-slate-900 dark:text-white">
            {isCertified ? '100%' : `${percentage.toFixed(0)}%`}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out mission-status-bar ${config?.color || 'bg-slate-500'}`}
            style={{ '--status-width': `${isCertified ? 100 : percentage}%` } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Detailed KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 leading-none">
            Indemnités
          </div>
            {budgetVariance > 10 ? (
              <TrendingUp size={12} className="text-rose-500" />
            ) : (
              <Zap size={12} className="text-emerald-500" />
            )}
            <span className="text-emerald-600">
               {new Intl.NumberFormat('fr-FR').format(members.reduce((s, m) => s + (m.dailyIndemnity || 0) * (m.days || 1), 0))} XOF
            </span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 leading-none">
            Effectif
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white">
            {members.length}{' '}
            <span className="text-[9px] opacity-40 font-bold uppercase ml-0.5">Pers.</span>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={12} className="text-indigo-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
              Checklist Pré-Déploiement
            </span>
          </div>
          <div className="space-y-1.5">
            {nextSteps.slice(0, 2).map((step: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 leading-tight"
              >
                <span className="text-indigo-500 font-bold">•</span>
                <span className="font-semibold">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

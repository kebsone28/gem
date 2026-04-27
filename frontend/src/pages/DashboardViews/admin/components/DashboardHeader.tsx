/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  RefreshCw,
  Database,
  Download,
  ArrowRight,
  Plus,
  Map,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  WifiOff,
} from 'lucide-react';
import {
  DASHBOARD_ACTION_TILE_PRIMARY,
  DASHBOARD_ACTION_TILE_SECONDARY,
  StatusBadge,
} from '../../../../components/dashboards/DashboardComponents';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  projectName: string;
  isSyncing: boolean;
  isLoading?: boolean;
  onSync: () => void;
  onExportCompta: () => void;
  projectProgress: number;
  missionsDone: number;
  missionsInProgress: number;
  errorCount: number;
  syncHealth?: 'healthy' | 'degraded' | 'critical';
  lastSyncLabel: string;
  koboConnected: boolean;
  exportAvailable: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  projectName,
  isSyncing,
  isLoading = false,
  onSync,
  onExportCompta,
  projectProgress,
  missionsDone,
  missionsInProgress,
  errorCount,
  syncHealth = 'healthy',
  lastSyncLabel,
  koboConnected,
  exportAvailable,
}) => {
  const navigate = useNavigate();
  const safeMissionsDone = Number.isFinite(missionsDone) ? missionsDone : 0;
  const safeMissionsInProgress = Number.isFinite(missionsInProgress) ? missionsInProgress : 0;
  const safeErrorCount = Number.isFinite(errorCount) ? errorCount : 0;
  const safeProjectProgress = Number.isFinite(projectProgress) ? projectProgress : 0;

  const serviceTone =
    syncHealth === 'critical' ? 'danger' : syncHealth === 'degraded' ? 'warning' : 'success';
  const syncLabel = isSyncing
    ? 'Synchronisation en cours'
    : syncHealth === 'critical'
      ? 'Erreur de synchronisation'
      : syncHealth === 'degraded'
        ? 'Synchronisation instable'
        : 'Synchronisé';

  const quickActions = [
    {
      label: 'Ajouter mission',
      description: 'Planifier une intervention',
      icon: Plus,
      onClick: () => navigate('/planning'),
      variant: 'secondary' as const,
    },
    {
      label: 'Scanner / collecter',
      description: 'Kobo et collecte rapide',
      icon: ScanLine,
      onClick: () => navigate('/admin/kobo-terminal'),
      variant: 'secondary' as const,
    },
    {
      label: 'Ouvrir carte',
      description: 'Voir zones et menages',
      icon: Map,
      onClick: () => navigate('/terrain'),
      variant: 'secondary' as const,
    },
    {
      label: isSyncing ? 'Synchronisation...' : 'Synchroniser',
      description: 'Action prioritaire',
      icon: RefreshCw,
      onClick: onSync,
      disabled: isSyncing,
      variant: 'primary' as const,
    },
  ];

  const statusCards = [
    {
      title: 'Synchro Cloud',
      value: syncLabel,
      meta: `Dernière sync ${lastSyncLabel}`,
      icon: syncHealth === 'critical' ? AlertTriangle : RefreshCw,
      tone:
        syncHealth === 'critical'
          ? 'text-rose-300 border-rose-500/20 bg-rose-500/10'
          : syncHealth === 'degraded'
            ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
            : 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    },
    {
      title: 'Moteur Kobo',
      value: koboConnected ? 'Connecté' : 'Déconnecté',
      meta: koboConnected ? 'Collecte et mapping disponibles' : 'Connexion requise',
      icon: koboConnected ? Database : WifiOff,
      tone: koboConnected
        ? 'text-blue-300 border-blue-500/20 bg-blue-500/10'
        : 'text-rose-300 border-rose-500/20 bg-rose-500/10',
    },
    {
      title: 'Export',
      value: exportAvailable ? 'Disponible' : 'Indisponible',
      meta: exportAvailable ? 'Export compta pret' : 'Donnees mission manquantes',
      icon: Download,
      tone: exportAvailable
        ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10'
        : 'text-slate-300 border-white/10 bg-white/[0.03]',
    },
  ];

  const pilotageCards = [
    { label: 'Missions réalisées', value: safeMissionsDone, icon: CheckCircle2 },
    { label: 'En cours', value: safeMissionsInProgress, icon: Clock3 },
    { label: 'Erreurs', value: safeErrorCount, icon: AlertTriangle },
    { label: 'Progression', value: `${safeProjectProgress}%`, icon: ArrowRight },
  ];

  return (
    <section className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,28,48,0.98),rgba(10,15,28,1))] px-4 py-4 shadow-[0_30px_80px_rgba(2,6,23,0.52)] backdrop-blur-2xl sm:rounded-[2.1rem] sm:px-5 sm:py-5 lg:px-7 lg:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.07),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
              <StatusBadge
                status={serviceTone}
                label={syncHealth === 'healthy' ? 'Terrain pret' : 'Verifier services'}
              />
              <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55 sm:text-[11px]">
                {projectName || 'Projet non defini'}
              </span>
            </div>
            <h1 className="text-[1.85rem] font-black tracking-[-0.05em] text-white sm:text-[2.45rem] xl:text-[3.1rem]">
              Console terrain
            </h1>
            <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-slate-400 sm:text-[0.98rem]">
              Pilotage terrain, sync et collecte hors-ligne.
            </p>
          </div>

          <button
            onClick={onSync}
            disabled={isSyncing || isLoading}
            className="flex h-13 w-full items-center justify-center gap-3 rounded-[1.2rem] border border-blue-500/20 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(13,20,35,1))] px-4 text-[0.82rem] font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)] transition-all hover:border-blue-400/35 hover:shadow-[0_20px_42px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:rounded-[1.45rem] sm:px-5 sm:text-[0.88rem] xl:w-auto xl:min-w-[280px]"
          >
            <RefreshCw
              size={20}
              className={isSyncing ? 'animate-spin' : 'transition-transform duration-500'}
            />
            {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.28fr)_minmax(290px,0.92fr)] lg:gap-4">
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4">
            {quickActions.map(({ label, description, icon: Icon, onClick, disabled, variant }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled || isLoading}
                className={`${variant === 'primary' ? DASHBOARD_ACTION_TILE_PRIMARY : DASHBOARD_ACTION_TILE_SECONDARY} min-h-[100px] rounded-[1.3rem] border-white/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[116px] sm:px-4.5 sm:py-4.5 sm:rounded-[1.45rem] ${variant === 'primary' ? 'bg-[linear-gradient(180deg,rgba(13,20,35,0.98),rgba(11,18,32,1))] text-white ring-1 ring-blue-500/35 shadow-[0_20px_40px_rgba(37,99,235,0.18)]' : 'bg-[linear-gradient(180deg,rgba(13,20,35,0.92),rgba(11,18,32,0.98))]'}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-[0.95rem] border sm:h-12 sm:w-12 sm:rounded-[1rem] ${
                      variant === 'primary'
                        ? 'border-white/10 bg-white/15'
                        : 'border-white/6 bg-white/[0.04]'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        disabled ? '' : variant === 'primary' ? 'text-white' : 'text-blue-300'
                      }
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[0.9rem] font-black uppercase tracking-[0.03em] text-white sm:text-[0.94rem]">
                      {label}
                    </p>
                    <p
                      className={`mt-1 text-[0.82rem] leading-snug sm:text-[0.88rem] ${
                        variant === 'primary' ? 'text-blue-100/90' : 'text-slate-400'
                      }`}
                    >
                      {description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {statusCards.map(({ title, value, meta, icon: Icon, tone }) => (
              <div
                key={title}
                className="rounded-[1.3rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-[1.55rem] sm:p-4.5"
              >
                <div className="flex min-h-[88px] items-start gap-3 sm:min-h-[96px] sm:gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border ${tone} sm:h-11 sm:w-11 sm:rounded-[1rem]`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.76rem] font-black uppercase tracking-[0.08em] text-slate-400 sm:text-[0.82rem]">
                      {title}
                    </p>
                    <p className="mt-1 text-[1.18rem] font-black tracking-[-0.04em] text-white sm:text-[1.45rem]">
                      {value}
                    </p>
                    <p className="mt-1 text-[0.82rem] leading-snug text-slate-400 sm:text-[0.86rem]">{meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pilotageCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:px-4"
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[0.8rem] bg-white/[0.04] text-blue-300 sm:h-9.5 sm:w-9.5 sm:rounded-[0.9rem]">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.05em] text-slate-400 sm:text-[0.72rem]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[1.15rem] font-black tracking-[-0.04em] text-white sm:text-[1.4rem]">
                    {value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 lg:max-w-[560px]">
          <button
            onClick={onExportCompta}
            disabled={!exportAvailable}
            className="flex h-12 items-center justify-center gap-2 rounded-[1.15rem] border border-emerald-500/20 bg-emerald-500/10 px-5 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] sm:h-13 sm:rounded-[1.35rem] sm:px-6 sm:text-[0.86rem]"
            title="Exporter les missions certifiées en Excel"
          >
            <Download size={16} />
            Exporter compta
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true } as any));
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-5 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-slate-200 transition-all hover:bg-white/[0.06] active:scale-[0.98] sm:h-13 sm:rounded-[1.35rem] sm:px-6 sm:text-[0.86rem]"
          >
            Hub d'actions
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};

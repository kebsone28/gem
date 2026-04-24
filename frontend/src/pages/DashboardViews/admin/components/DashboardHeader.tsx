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
  DASHBOARD_MINI_STAT_CARD,
  DASHBOARD_PRIMARY_BUTTON,
  DASHBOARD_STICKY_PANEL,
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
      onClick: () => navigate('/admin/kobo-mapping'),
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
      meta: `Derniere sync ${lastSyncLabel}`,
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
      value: koboConnected ? 'Connecte' : 'Deconnecte',
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
    { label: 'Missions realisees', value: safeMissionsDone, icon: CheckCircle2 },
    { label: 'En cours', value: safeMissionsInProgress, icon: Clock3 },
    { label: 'Erreurs', value: safeErrorCount, icon: AlertTriangle },
    { label: 'Progression', value: `${safeProjectProgress}%`, icon: ArrowRight },
  ];

  return (
    <div className={DASHBOARD_STICKY_PANEL}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge
                status={serviceTone}
                label={syncHealth === 'healthy' ? 'Terrain pret' : 'Verifier services'}
              />
              <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                {projectName || 'Projet non defini'}
              </span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
              Console terrain
            </h1>
            <p className="text-[13px] text-slate-400">
              Pilotage terrain, sync et collecte hors-ligne.
            </p>
          </div>

          <button
            onClick={onSync}
            disabled={isSyncing || isLoading}
            className={`${DASHBOARD_PRIMARY_BUTTON} w-full disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:min-w-[220px]`}
          >
            <RefreshCw
              size={16}
              className={isSyncing ? 'animate-spin' : 'transition-transform duration-500'}
            />
            {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, description, icon: Icon, onClick, disabled, variant }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled || isLoading}
                className={`${variant === 'primary' ? DASHBOARD_ACTION_TILE_PRIMARY : DASHBOARD_ACTION_TILE_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      variant === 'primary' ? 'bg-white/15' : 'bg-white/5'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        disabled ? '' : variant === 'primary' ? 'text-white' : 'text-blue-300'
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.06em]">{label}</p>
                    <p
                      className={`mt-1 text-[12px] ${
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {statusCards.map(({ title, value, meta, icon: Icon, tone }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                      {title}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">{value}</p>
                    <p className="mt-1 text-[12px] text-slate-400">{meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {pilotageCards.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className={DASHBOARD_MINI_STAT_CARD.replace('min-w-[170px]', 'min-w-[180px]')}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-black tracking-tight text-white">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExportCompta}
            disabled={!exportAvailable}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            title="Exporter les missions certifiees en Excel"
          >
            <Download size={16} />
            Exporter compta
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true } as any));
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition-all hover:bg-white/[0.06] active:scale-[0.98]"
          >
            Hub d'actions
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

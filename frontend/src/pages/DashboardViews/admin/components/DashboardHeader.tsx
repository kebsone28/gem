/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { motion } from 'framer-motion';
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
      kicker: 'Planification',
      label: 'Ajouter mission',
      description: 'Planifier une intervention',
      icon: Plus,
      onClick: () => navigate('/planning'),
      variant: 'secondary' as const,
    },
    {
      kicker: 'Collecte',
      label: 'Scanner / collecter',
      description: 'Kobo et collecte rapide',
      icon: ScanLine,
      onClick: () => navigate('/admin/kobo-terminal'),
      variant: 'secondary' as const,
    },
    {
      kicker: 'Terrain',
      label: 'Ouvrir carte',
      description: 'Voir zones et menages',
      icon: Map,
      onClick: () => navigate('/terrain'),
      variant: 'secondary' as const,
    },
    {
      kicker: 'Priorité',
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

  const heroSignals = [
    { label: 'Statut', value: syncHealth === 'healthy' ? 'Stable' : syncHealth === 'degraded' ? 'Surveillance' : 'Alerte' },
    { label: 'Kobo', value: koboConnected ? 'Connecté' : 'Hors ligne' },
    { label: 'Export', value: exportAvailable ? 'Prêt' : 'En attente' },
  ];

  return (
    <motion.section 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.95))] px-5 py-6 shadow-[0_40px_100px_rgba(2,6,23,0.6)] backdrop-blur-3xl sm:rounded-[2.5rem] sm:px-8 sm:py-8 lg:px-10 lg:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4 flex flex-wrap items-center gap-3"
            >
              <StatusBadge
                status={serviceTone}
                label={syncHealth === 'healthy' ? 'Système Opérationnel' : 'Vérification requise'}
              />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <div className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  GED OS — {projectName || 'Projet non défini'}
                </span>
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              className="text-[1.8rem] xs:text-[2.2rem] sm:text-[3rem] xl:text-[4.2rem] font-black tracking-[-0.06em] text-white leading-[0.95]"
            >
              Console <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">Stratégique</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 max-w-2xl text-[1rem] font-medium leading-relaxed text-slate-400 sm:text-[1.1rem]"
            >
              Supervision en temps réel des opérations terrain et synchronisation intelligentes des flux Kobo.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 flex flex-wrap gap-3"
            >
              {heroSignals.map(({ label, value }) => (
                <div
                  key={label}
                  className="group flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 transition-all hover:bg-white/[0.05] hover:border-white/10"
                >
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-500 group-hover:text-slate-400">
                    {label}
                  </span>
                  <div className="h-4 w-px bg-white/10" />
                  <span className="text-[0.75rem] font-black uppercase tracking-[0.1em] text-white">
                    {value}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col gap-3 sm:flex-row xl:flex-col"
          >
            <button
              onClick={onSync}
              disabled={isSyncing || isLoading}
              className="group relative flex h-14 sm:h-16 items-center justify-center gap-4 overflow-hidden rounded-2xl bg-blue-600 px-6 sm:px-8 text-[0.85rem] sm:text-[0.95rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_20px_40px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.02] hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 xl:min-w-[320px]"
            >
              <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="absolute inset-0 bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <RefreshCw
                size={20}
                className={isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}
              />
              <span className="relative z-10">
                {isSyncing ? 'Mise à jour...' : 'Synchronisation Totale'}
              </span>
            </button>
            
            <div className="flex items-center justify-between px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dernier état</span>
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">{lastSyncLabel}</span>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:gap-4">
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
            {quickActions.map(({ kicker, label, description, icon: Icon, onClick, disabled, variant }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled || isLoading}
                className={`${variant === 'primary' ? DASHBOARD_ACTION_TILE_PRIMARY : DASHBOARD_ACTION_TILE_SECONDARY} min-h-[102px] rounded-[1.3rem] border-white/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[108px] sm:px-4.5 sm:py-4.5 sm:rounded-[1.45rem] ${variant === 'primary' ? 'bg-[linear-gradient(180deg,rgba(13,20,35,0.98),rgba(11,18,32,1))] text-white ring-1 ring-blue-500/35 shadow-[0_20px_40px_rgba(37,99,235,0.18)]' : 'bg-[linear-gradient(180deg,rgba(13,20,35,0.92),rgba(11,18,32,0.98))]'}`}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
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
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.14em] ${
                        variant === 'primary'
                          ? 'bg-blue-500/20 text-blue-100'
                          : 'bg-white/[0.05] text-slate-500'
                      }`}
                    >
                      {kicker}
                    </span>
                  </div>
                  <div
                    className={`min-w-0 rounded-[1rem] border px-3 py-3 text-left ${
                      variant === 'primary'
                        ? 'border-white/8 bg-white/[0.04]'
                        : 'border-white/6 bg-black/10'
                    }`}
                  >
                    <p className="text-[0.88rem] font-black uppercase tracking-[0.02em] text-white sm:text-[0.95rem]">
                      {label}
                    </p>
                    <p
                      className={`mt-1 text-[0.8rem] leading-snug sm:text-[0.86rem] ${
                        variant === 'primary' ? 'text-blue-100/90' : 'text-slate-400'
                      }`}
                    >
                      {description}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-slate-500">
                      Ouvrir
                      <ArrowRight size={12} className={variant === 'primary' ? 'text-blue-200' : 'text-slate-500'} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
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

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
    </motion.section>
  );
};

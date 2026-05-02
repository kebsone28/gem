import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, CloudOff, Lock, RefreshCcw, X } from 'lucide-react';
import type { ConflictRecord } from '../../services/sync/conflictResolver';
import type { Household } from '../../utils/types';

interface TerrainSyncIssuesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
  conformingHouseholdsCount: number;
  lockableConformingHouseholdsCount: number;
  unlockableConformingHouseholdsCount: number;
  pendingHouseholds: Household[];
  errorHouseholds: Household[];
  conflicts: ConflictRecord[];
  lastSyncError: string | null;
  lastSyncAt?: number | null;
  isSyncing: boolean;
  onRepair: () => Promise<void>;
  onSync: () => Promise<void>;
  onLockConforming: () => Promise<void>;
  onUnlockConforming: () => Promise<void>;
  onSelectHousehold: (householdId: string) => void;
  showBulkConformingActions?: boolean;
}

const getHouseholdLabel = (household: Household) =>
  household.numeroordre || household.name || household.owner || household.id.slice(-6);

const getOverrideCount = (household: Household) =>
  Array.isArray(household.manualOverrides) ? household.manualOverrides.length : 0;

export const TerrainSyncIssuesPanel: React.FC<TerrainSyncIssuesPanelProps> = ({
  isOpen,
  onClose,
  pendingSyncCount,
  conformingHouseholdsCount,
  lockableConformingHouseholdsCount,
  unlockableConformingHouseholdsCount,
  pendingHouseholds,
  errorHouseholds,
  conflicts,
  lastSyncError,
  lastSyncAt = null,
  isSyncing,
  onRepair,
  onSync,
  onLockConforming,
  onUnlockConforming,
  onSelectHousehold,
  showBulkConformingActions = true,
}) => {
  if (!isOpen) return null;

  const visiblePending = pendingHouseholds.slice(0, 6);
  const visibleErrors = errorHouseholds.slice(0, 6);
  const visibleConflicts = conflicts.slice(-5).reverse();
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Jamais synchronisé';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[3200] flex items-end justify-center bg-black/60 backdrop-blur-sm p-3 md:items-center md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          className="w-full max-w-2xl max-h-[92dvh] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl md:max-h-[88vh]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-white/5 p-5 md:p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.28em] text-amber-400">
                Santé Sync Terrain
              </p>
              <h3 className="mt-2 text-xl font-black uppercase tracking-tight">
                Reprise et conflits
              </h3>
            </div>
            <button
              onClick={onClose}
              title="Fermer le panneau"
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[calc(92dvh-164px)] space-y-6 overflow-y-auto p-4 sm:p-5 md:max-h-[calc(88vh-164px)] md:p-6">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">
                Règle métier sync
              </p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-blue-50">
                Kobo met à jour les ménages préchargés par défaut. Seuls les champs verrouillés
                dans le formulaire admin restent prioritaires côté local.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
                    Dernière sync
                  </p>
                  <p className="mt-1 text-sm font-black text-cyan-50">{lastSyncLabel}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
                    Source active
                  </p>
                  <p className="mt-1 text-sm font-black text-cyan-50">
                    {lastSyncError ? 'Cache + reprise' : 'Serveur + cache'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
                    État
                  </p>
                  <p className="mt-1 text-sm font-black text-cyan-50">
                    {isSyncing ? 'Synchronisation...' : lastSyncError ? 'À corriger' : 'Stable'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                  File attente
                </p>
                <p className="mt-2 text-2xl font-black">{pendingSyncCount}</p>
              </div>
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">
                  Ménages pending
                </p>
                <p className="mt-2 text-2xl font-black">{pendingHouseholds.length}</p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-300">
                  Erreurs / conflits
                </p>
                <p className="mt-2 text-2xl font-black">{errorHouseholds.length + conflicts.length}</p>
              </div>
            </div>

            {showBulkConformingActions && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                    Protection des ménages conformes
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-50">
                    Verrouille en masse les champs métier des ménages déjà conformes pour éviter
                    qu'une synchronisation Kobo écrase des dossiers validés.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100">
                      {conformingHouseholdsCount} conforme(s)
                    </span>
                    <span className="rounded-full border border-amber-500/20 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                      {lockableConformingHouseholdsCount} à verrouiller
                    </span>
                    <span className="rounded-full border border-blue-500/20 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-100">
                      {unlockableConformingHouseholdsCount} à déverrouiller
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:w-[280px]">
                  <button
                    onClick={() => void onLockConforming()}
                    disabled={lockableConformingHouseholdsCount === 0 || isSyncing}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-50 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock size={14} />
                    Verrouiller les conformes
                  </button>
                  <button
                    onClick={() => void onUnlockConforming()}
                    disabled={unlockableConformingHouseholdsCount === 0 || isSyncing}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/30 bg-blue-500/15 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-blue-50 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock size={14} />
                    Déverrouiller les conformes
                  </button>
                </div>
              </div>
              </div>
            )}

            {lastSyncError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 text-rose-400" size={18} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">
                      Dernière erreur sync
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-rose-100">
                      {lastSyncError}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {visiblePending.length > 0 ? (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Ménages en attente
                </p>
                <div className="space-y-2">
                  {visiblePending.map((household) => (
                    <button
                      key={household.id}
                      onClick={() => onSelectHousehold(household.id)}
                      className="flex w-full items-center justify-between rounded-2xl border border-amber-500/15 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                    >
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight">
                          {getHouseholdLabel(household)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {household.region || 'Région inconnue'} • {household.status || 'Sans statut'}
                        </p>
                        {getOverrideCount(household) > 0 ? (
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                            <Lock size={10} />
                            {getOverrideCount(household)} champ(s) forcé(s) admin
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                        <RefreshCcw size={10} className="animate-spin" />
                        Pending
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {visibleErrors.length > 0 ? (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Ménages en erreur
                </p>
                <div className="space-y-2">
                  {visibleErrors.map((household) => (
                    <button
                      key={household.id}
                      onClick={() => onSelectHousehold(household.id)}
                      className="flex w-full items-center justify-between rounded-2xl border border-rose-500/15 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                    >
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight">
                          {getHouseholdLabel(household)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {household.region || 'Région inconnue'} • reprise requise
                        </p>
                        {getOverrideCount(household) > 0 ? (
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                            <Lock size={10} />
                            {getOverrideCount(household)} champ(s) forcé(s) admin
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300">
                        <CloudOff size={10} />
                        Erreur
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {visibleConflicts.length > 0 ? (
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Conflits récents
                </p>
                <div className="space-y-2">
                  {visibleConflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="rounded-2xl border border-indigo-500/15 bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black uppercase tracking-tight">
                          {conflict.entityType} • {conflict.entityId}
                        </p>
                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                          {conflict.strategy}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Résolu {new Date(conflict.resolvedAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {visiblePending.length === 0 &&
            visibleErrors.length === 0 &&
            visibleConflicts.length === 0 &&
            !lastSyncError ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-100">
                    Aucun incident terrain détecté. La file de synchronisation est saine.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/5 bg-black/20 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 md:flex-row md:justify-end md:p-6">
            <button
              onClick={() => void onRepair()}
              className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Réparer la file
            </button>
            <button
              onClick={() => void onSync()}
              disabled={isSyncing}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TerrainSyncIssuesPanel;

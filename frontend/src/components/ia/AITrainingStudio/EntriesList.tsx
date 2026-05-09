/**
 * 📚 EntriesList - Composant de liste des entrées d'entraînement
 * Affiche et gère les réponses mémorisées avec recherche et filtrage
 */

import React, { useMemo } from 'react';
import { Archive, BookOpen, CheckCircle2, Loader2, Search, X } from 'lucide-react';
import type { MentorTrainingEntry } from '../../../services/ai/mentorTrainingService';
import type { MissionSageLearningLog } from '../../../services/ai/missionSageLearningLogService';

interface EntriesListProps {
  entries: MentorTrainingEntry[];
  unresolvedLogs: MissionSageLearningLog[];
  scopeRedirectLogs: MissionSageLearningLog[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedEntryId: string | null;
  onSelectEntry: (entry: MentorTrainingEntry) => void;
  onSelectUnresolved: (log: MissionSageLearningLog) => void;
  onCloseEntry: (entry: MentorTrainingEntry) => void;
  onAcceptEntry: (entry: MentorTrainingEntry) => void;
  mobile?: boolean;
  onClose?: () => void;
}

export default function EntriesList({
  entries,
  unresolvedLogs,
  scopeRedirectLogs,
  isLoading,
  search,
  onSearchChange,
  selectedEntryId,
  onSelectEntry,
  onSelectUnresolved,
  onCloseEntry,
  onAcceptEntry,
  mobile = false,
  onClose,
}: EntriesListProps) {
  const isEntryClosed = (entry: MentorTrainingEntry) =>
    entry.lifecycleStatus === 'closed' || entry.active === false;
  const isEntryAccepted = (entry: MentorTrainingEntry) => entry.lifecycleStatus === 'accepted';

  const visibleEntries = useMemo(
    () => entries.filter((entry) => !isEntryAccepted(entry) && !isEntryClosed(entry)),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const token = search.trim().toLowerCase();
    if (!token) return visibleEntries;
    return visibleEntries.filter(
      (entry) =>
        entry.question.toLowerCase().includes(token) || entry.answer.toLowerCase().includes(token)
    );
  }, [visibleEntries, search]);

  const activeEntriesCount = visibleEntries.length;

  return (
    <>
      <div className="border-b border-white/6 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-slate-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
              Réponses mémorisées
            </p>
          </div>
          {mobile && onClose && (
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Fermer le panneau"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
            {activeEntriesCount} active(s)
          </span>
        </div>
        <div className="relative mt-4">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher une question mémorisée"
            className="w-full rounded-2xl border border-white/8 bg-slate-900/70 py-3 pr-4 pl-9 text-sm font-medium text-white outline-none placeholder:text-slate-500 focus:border-white/15"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {unresolvedLogs.length > 0 && (
          <div className="mb-5 rounded-[1.5rem] border border-amber-400/15 bg-amber-400/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                Questions non résolues
              </p>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                {unresolvedLogs.length}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {unresolvedLogs.map((log) => (
                <button
                  key={`${log.id || log.query}-${String(log.timestamp)}`}
                  onClick={() => onSelectUnresolved(log)}
                  className="block w-full rounded-2xl border border-amber-300/10 bg-slate-950/35 px-3 py-3 text-left text-xs font-semibold leading-5 text-amber-50 transition-colors hover:bg-slate-950/55"
                  title="Charger cette question dans l'éditeur"
                >
                  {log.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {scopeRedirectLogs.length > 0 && (
          <div className="mb-5 rounded-[1.5rem] border border-cyan-400/15 bg-cyan-400/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                Questions recadrées
              </p>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100">
                {scopeRedirectLogs.length}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-cyan-50/80">
              Ces questions étaient hors périmètre ou trop générales. Chargez-les seulement si une
              vraie règle métier doit être ajoutée.
            </p>
            <div className="mt-3 space-y-2">
              {scopeRedirectLogs.map((log) => (
                <button
                  key={`${log.id || log.query}-${String(log.timestamp)}`}
                  onClick={() => onSelectUnresolved(log)}
                  className="block w-full rounded-2xl border border-cyan-300/10 bg-slate-950/35 px-3 py-3 text-left text-xs font-semibold leading-5 text-cyan-50 transition-colors hover:bg-slate-950/55"
                  title="Charger cette question recadrée dans l'éditeur"
                >
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200/80">
                    {log.context === 'work_redirect' ? 'Priorisation travail' : 'Hors périmètre'}
                  </span>
                  {log.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm font-semibold text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Chargement des réponses mémorisées...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 px-5 py-10 text-center text-sm leading-7 text-slate-500">
            Aucune réponse mémorisée pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-[1.5rem] border p-4 transition-colors ${
                  selectedEntryId === entry.id
                    ? 'border-cyan-400/30 bg-cyan-400/10'
                    : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectEntry(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectEntry(entry);
                      }
                    }}
                    className="min-w-0"
                  >
                    <p className="text-sm font-black leading-6 text-white">{entry.question}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Mise à jour {new Date(entry.updatedAt).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
                        Override actif
                      </span>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                        Match exact
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void onAcceptEntry(entry);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200 transition-colors hover:bg-emerald-400/15"
                      title="Accepter définitivement"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void onCloseEntry(entry);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-200 transition-colors hover:bg-amber-400/15"
                      title="Clôturer cette réponse mémorisée"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/6 bg-slate-950/50 px-3 py-3">
                  <p className="line-clamp-4 text-[12.5px] font-medium leading-6 text-slate-200/90 whitespace-pre-wrap">
                    {entry.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

import React, { useState } from 'react';
import { ChevronRight, Download, RefreshCcw } from 'lucide-react';
import type { InternalKoboSubmissionRecord } from '@services/internalKoboSubmissionService';
import { formatInternalGedOsValue } from '../internalKoboFormDefinition';
import { formatHistoryDate, submissionStatusClass, submissionStatusLabel } from './utils';

type HistoryPanelProps = {
  submissions: InternalKoboSubmissionRecord[];
  compact?: boolean;
  isHistoryLoading?: boolean;
  historyError?: string;
  onRefreshHistory?: () => void;
  onDownloadHistory?: () => void;
  onViewReceipt: (submission: InternalKoboSubmissionRecord) => void;
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  submissions,
  compact = false,
  isHistoryLoading = false,
  historyError,
  onRefreshHistory,
  onDownloadHistory,
  onViewReceipt,
}) => {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const visibleHistory = submissions.slice(0, isHistoryExpanded ? (compact ? 2 : 3) : 1);
  const hiddenHistoryCount = Math.max(0, submissions.length - visibleHistory.length);
  const latestSubmission = submissions[0];

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.045] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Historique VPS</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">
            {submissions.length
              ? `${submissions.length} derniere(s) chargee(s) - apercu compact`
              : 'Aucune soumission serveur'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {submissions.length > 0 && onDownloadHistory ? (
            <button
              type="button"
              onClick={onDownloadHistory}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-slate-300 transition-colors hover:text-white"
              aria-label="Exporter l'historique GED OS Collect"
              title="Exporter l'historique JSON"
            >
              <Download size={14} />
            </button>
          ) : null}
          {submissions.length > 1 ? (
            <button
              type="button"
              onClick={() => setIsHistoryExpanded((current) => !current)}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-slate-300 transition-colors hover:text-white"
              aria-label={isHistoryExpanded ? 'Replier l historique VPS' : 'Afficher plus d historique VPS'}
              title={isHistoryExpanded ? 'Replier' : 'Afficher plus'}
            >
              <ChevronRight size={14} className={`transition-transform ${isHistoryExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : null}
          {onRefreshHistory ? (
            <button
              type="button"
              onClick={onRefreshHistory}
              disabled={isHistoryLoading}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-slate-300 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Actualiser l'historique VPS"
            >
              <RefreshCcw size={14} className={isHistoryLoading ? 'animate-spin' : ''} />
            </button>
          ) : null}
        </div>
      </div>

      {historyError ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[10px] font-bold text-amber-100">
          {historyError}
        </div>
      ) : null}

      <div className={`${latestSubmission || isHistoryLoading || historyError ? 'mt-3' : ''} space-y-2`}>
        {isHistoryLoading && submissions.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-slate-950/30 px-3 py-3 text-[10px] font-bold text-slate-400">
            CharGedOsent de l'historique...
          </div>
        ) : null}

        {visibleHistory.map((submission) => {
          const missingCount = Array.isArray(submission.requiredMissing) ? submission.requiredMissing.length : 0;
          return (
            <div key={submission.id} className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-white">
                    {formatInternalGedOsValue(submission.role || 'role non defini', 'roles')}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">
                    {formatHistoryDate(submission.savedAt)} - v{submission.formVersion}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${submissionStatusClass(submission.status)}`}>
                  {submissionStatusLabel(submission.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-slate-400">
                <span className="rounded-full bg-white/[0.05] px-2 py-1">
                  {missingCount ? `${missingCount} requis manquant(s)` : 'Complet'}
                </span>
                {submission.submittedBy?.name || submission.submittedBy?.email ? (
                  <span className="rounded-full bg-white/[0.05] px-2 py-1">
                    {String(submission.submittedBy.name || submission.submittedBy.email)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onViewReceipt(submission)}
                  className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-blue-100 hover:bg-blue-300/18"
                >
                  Voir recu
                </button>
              </div>
            </div>
          );
        })}

        {hiddenHistoryCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsHistoryExpanded((current) => !current)}
            className="w-full rounded-xl border border-white/[0.08] bg-slate-950/25 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 transition-colors hover:border-blue-200/20 hover:text-blue-100"
          >
            {isHistoryExpanded
              ? `Replier - ${hiddenHistoryCount} autre(s) non affichee(s)`
              : `Voir ${hiddenHistoryCount} autre(s) soumission(s) chargee(s)`}
          </button>
        ) : null}

        {!isHistoryLoading && submissions.length === 0 && !historyError ? (
          <div className="rounded-xl border border-white/8 bg-slate-950/30 px-3 py-3 text-[10px] font-bold text-slate-500">
            Aucun envoi interne trouve pour ce menage.
          </div>
        ) : null}
      </div>
    </div>
  );
};

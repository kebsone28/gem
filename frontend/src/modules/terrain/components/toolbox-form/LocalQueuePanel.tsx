import React from 'react';
import { RefreshCcw } from 'lucide-react';
import type { toolboxQueuedSubmission } from '@services/toolboxSubmissionService';
import { formatInternalGedOsValue } from '../toolboxFormDefinition';
import { formatHistoryDate, queueStatusClass, queueStatusLabel, submissionStatusLabel } from './utils';

type LocalQueuePanelProps = {
  queueItems: toolboxQueuedSubmission[];
  compact?: boolean;
  onFlushQueue?: () => void;
  isQueueFlushing?: boolean;
  isOnline?: boolean;
};

export const LocalQueuePanel: React.FC<LocalQueuePanelProps> = ({
  queueItems,
  compact = false,
  onFlushQueue,
  isQueueFlushing = false,
  isOnline = true,
}) => {
  if (queueItems.length === 0) return null;

  const visibleQueueItems = queueItems.slice(0, compact ? 2 : 4);

  return (
    <div className={`rounded-2xl border border-sky-300/15 bg-sky-400/[0.055] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-100">File locale</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">
            {queueItems.length} saisie(s) gardee(s) sur cet appareil
          </p>
        </div>
        {onFlushQueue ? (
          <button
            type="button"
            onClick={onFlushQueue}
            disabled={isQueueFlushing || !isOnline}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-sky-300/20 bg-sky-300/10 px-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-sky-100 transition-colors hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCcw size={13} className={isQueueFlushing ? 'animate-spin' : ''} />
            Envoyer
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {visibleQueueItems.map((item) => (
          <div key={`${item.id || item.clientSubmissionId}`} className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-white">
                  {item.numeroOrdre ? `Menage ${item.numeroOrdre}` : 'Menage non renseigne'}
                </p>
                <p className="mt-1 text-[9px] font-semibold text-slate-500">
                  {formatInternalGedOsValue(item.role || 'role non defini', 'roles')} - {formatHistoryDate(new Date(item.timestamp).toISOString())}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${queueStatusClass(item.status)}`}>
                {queueStatusLabel(item.status, item.retryCount)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-slate-400">
              <span className="rounded-full bg-white/[0.05] px-2 py-1">
                {submissionStatusLabel(item.submissionStatus)}
              </span>
              <span className="rounded-full bg-white/[0.05] px-2 py-1">
                {item.retryCount} tentative(s)
              </span>
              {item.nextRetryAt && item.nextRetryInMs ? (
                <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-100">
                  prochain essai {Math.ceil(item.nextRetryInMs / 1000)}s
                </span>
              ) : null}
              {item.mediaBytes ? (
                <span className="rounded-full bg-white/[0.05] px-2 py-1">
                  {Math.round(item.mediaBytes / 1024)} Ko media
                </span>
              ) : null}
              {item.lastError ? (
                <span className="max-w-full truncate rounded-full bg-rose-400/10 px-2 py-1 text-rose-100">
                  {item.lastError}
                </span>
              ) : null}
            </div>
          </div>
        ))}
        {queueItems.length > visibleQueueItems.length ? (
          <div className="rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2 text-[10px] font-bold text-slate-500">
            +{queueItems.length - visibleQueueItems.length} autre(s) saisie(s) en file.
          </div>
        ) : null}
      </div>
    </div>
  );
};

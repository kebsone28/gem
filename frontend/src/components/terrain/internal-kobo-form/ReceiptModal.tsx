import React from 'react';
import { Copy, Download, X } from 'lucide-react';
import type { InternalKoboSubmissionRecord } from '../../../services/internalKoboSubmissionService';
import { formatInternalGedOsValue } from '../internalKoboFormDefinition';
import { formatHistoryDate, submissionStatusLabel, formatMetadataLabel } from './utils';

type ReceiptModalProps = {
  receiptSubmission: InternalKoboSubmissionRecord;
  copiedReceiptId: string;
  copyReceiptId: (submission: InternalKoboSubmissionRecord) => void;
  downloadReceiptJson: (submission: InternalKoboSubmissionRecord) => void;
  onClose: () => void;
  fieldLabelByName: Map<string, string>;
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receiptSubmission,
  copiedReceiptId,
  copyReceiptId,
  downloadReceiptJson,
  onClose,
  fieldLabelByName,
}) => {
  const valueEntries = Object.entries(receiptSubmission.values || {})
    .filter(([key, value]) => {
      if (key.startsWith('_')) return false;
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== '';
    })
    .slice(0, 14);

  const missingItems = Array.isArray(receiptSubmission.requiredMissing)
    ? receiptSubmission.requiredMissing
    : [];

  const metadataEntries = Object.entries(receiptSubmission.metadata || {})
    .filter(([key, value]) => {
      if (!key || value === undefined || value === null) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    })
    .slice(0, 8);

  const clientMetadataEntries = Object.entries(receiptSubmission.values || {})
    .filter(([key, value]) => {
      const isClientMetadata =
        key.startsWith('_GedOs_collection_') ||
        key.startsWith('_GedOs_client_') ||
        key.startsWith('_GedOs_session_') ||
        key.startsWith('_ged_os_collection_') ||
        key.startsWith('_ged_os_client_') ||
        key.startsWith('_ged_os_session_');
      if (!isClientMetadata) return false;
      if (value === undefined || value === null) return false;
      return String(value).trim().length > 0;
    })
    .slice(0, 12);

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-slate-950/72 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-[1.5rem] border border-blue-300/20 bg-[#0B1728] shadow-2xl shadow-blue-950/30">
        <div className="shrink-0 border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Reçu GED OS Collect</p>
              <h4 className="mt-2 truncate text-xl font-black uppercase tracking-tight text-white">
                {receiptSubmission.numeroOrdre ? `Menage ${receiptSubmission.numeroOrdre}` : 'Soumission terrain'}
              </h4>
              <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-300">
                Identifiant: <span className="font-black text-blue-100">{receiptSubmission.clientSubmissionId}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => copyReceiptId(receiptSubmission)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                aria-label="Copier l'identifiant du recu"
                title={copiedReceiptId === receiptSubmission.clientSubmissionId ? 'Copie' : "Copier l'identifiant"}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                onClick={() => downloadReceiptJson(receiptSubmission)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                aria-label="Telecharger le recu JSON"
                title="Telecharger le recu JSON"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                aria-label="Fermer le recu de soumission"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {copiedReceiptId === receiptSubmission.clientSubmissionId ? (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
              Identifiant copie
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Statut</p>
              <p className="mt-1 truncate text-sm font-black text-white">{submissionStatusLabel(receiptSubmission.status)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Role</p>
              <p className="mt-1 truncate text-sm font-black text-white">{formatInternalGedOsValue(receiptSubmission.role || '', 'roles') || 'Non defini'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Date</p>
              <p className="mt-1 truncate text-sm font-black text-white">{formatHistoryDate(receiptSubmission.savedAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Version</p>
              <p className="mt-1 truncate text-sm font-black text-white">v{receiptSubmission.formVersion}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
          {missingItems.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Requis manquants au moment de l'envoi</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingItems.map((fieldName: string) => (
                  <span key={fieldName} className="rounded-full border border-amber-200/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-bold text-amber-50">
                    {fieldLabelByName.get(fieldName) || fieldName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Apercu des valeurs envoyees</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {valueEntries.map(([key, value]) => (
                <div key={key} className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 p-3">
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    {fieldLabelByName.get(key) || key}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-slate-100">
                    {formatInternalGedOsValue(value)}
                  </p>
                </div>
              ))}
            </div>
            {valueEntries.length === 0 ? (
              <p className="mt-3 text-[11px] font-semibold text-slate-500">Aucune valeur exploitable dans ce recu.</p>
            ) : null}
          </div>

          {metadataEntries.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Metadonnees de collecte</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 p-3">
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {key}
                    </p>
                    <p className="mt-1 line-clamp-3 break-words text-[11px] font-bold leading-snug text-slate-100">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {clientMetadataEntries.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Contexte appareil</p>
              <p className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-400">
                Donnees techniques jointes automatiquement pour tracer la saisie, le mode hors-ligne et la session.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {clientMetadataEntries.map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-xl border border-cyan-200/10 bg-slate-950/25 p-3">
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200/70">
                      {formatMetadataLabel(key)}
                    </p>
                    <p className="mt-1 line-clamp-3 break-words text-[11px] font-bold leading-snug text-slate-100">
                      {key === '_ged_os_client_touch' || key === '_GedOs_client_touch'
                        ? String(value) === 'true' ? 'Oui' : 'Non'
                        : key === '_ged_os_session_duration_s' || key === '_GedOs_session_duration_s'
                          ? `${String(value)} s`
                          : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

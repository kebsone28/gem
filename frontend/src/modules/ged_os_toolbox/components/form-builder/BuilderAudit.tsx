/**
 * BuilderAudit — Panneau d'audit Kobo pour le Form Builder
 * Extrait de ToolboxSubmissions.tsx
 */
import React from 'react';
import type { BuilderAuditIssue } from './types';

interface BuilderAuditProps {
  auditScore: number;
  auditErrors: BuilderAuditIssue[];
  auditWarnings: BuilderAuditIssue[];
  auditIssues: BuilderAuditIssue[];
  onSelectQuestion: (questionId: string) => void;
}

export const BuilderAudit: React.FC<BuilderAuditProps> = ({
  auditScore,
  auditErrors,
  auditWarnings,
  auditIssues,
  onSelectQuestion,
}) => {
  const hasErrors = auditErrors.length > 0;
  const hasWarnings = auditWarnings.length > 0;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[260px_1fr]">
      {/* Score */}
      <div
        className={`rounded-2xl border p-4 ${
          hasErrors
            ? 'border-rose-200 bg-rose-50'
            : hasWarnings
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Audit Kobo
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-3xl font-black text-slate-950">
            {auditScore}%
          </span>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
              hasErrors
                ? 'bg-rose-100 text-rose-800'
                : hasWarnings
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {hasErrors
              ? `${auditErrors.length} erreur(s)`
              : hasWarnings
                ? `${auditWarnings.length} alerte(s)`
                : 'Pret'}
          </span>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-600">
          Controle structure XLSForm, roles, langues, choix, version et collecte
          offline avant sauvegarde VPS.
        </p>
      </div>

      {/* Issues */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Points a traiter
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Les erreurs bloquent la sauvegarde. Les alertes indiquent les ecarts
              Kobo a surveiller.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
            {auditErrors.length} bloquant(s) / {auditWarnings.length} alerte(s)
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {auditIssues.length > 0 ? (
            auditIssues.slice(0, 6).map((issue) => (
              <button
                key={`${issue.level}-${issue.title}-${issue.questionId || 'project'}`}
                type="button"
                onClick={() => issue.questionId && onSelectQuestion(issue.questionId)}
                className={`rounded-xl border px-3 py-2 text-left ${
                  issue.level === 'error'
                    ? 'border-rose-200 bg-white text-rose-900'
                    : 'border-amber-200 bg-white text-amber-900'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.12em]">
                  {issue.level === 'error' ? 'Erreur' : 'Alerte'}
                </span>
                <span className="mt-1 block text-xs font-black">
                  {issue.title}
                </span>
                <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-600">
                  {issue.detail}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm font-bold text-emerald-800">
              Aucun blocage detecte. Le brouillon peut etre cree sur le VPS.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export type RuntimeIssueView = {
  field: any;
  type: 'required' | 'constraint';
  message: string;
  runtimeIssue?: any;
  section?: any;
  runtimePage?: any;
};

type ValidationAssistantPanelProps = {
  validationIssues: RuntimeIssueView[];
  missingRequired: RuntimeIssueView[];
  constraintIssues: RuntimeIssueView[];
  firstActionableIssue?: RuntimeIssueView;
  validationIssueDetails: RuntimeIssueView[];
  focusRequiredField: (fieldName: string, sectionId?: string, runtimePageId?: string) => void;
};

export const ValidationAssistantPanel: React.FC<ValidationAssistantPanelProps> = ({
  validationIssues,
  missingRequired,
  constraintIssues,
  firstActionableIssue,
  validationIssueDetails,
  focusRequiredField,
}) => {
  if (validationIssues.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-100">
            <CheckCircle2 size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-emerald-100">Validation GED OS Collect prête</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-300">
              Tous les champs visibles requis sont remplis. La prochaine action soumettra la fiche au serveur VPS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-amber-100">Validation GED OS Collect incomplète</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-300">
            {missingRequired.length} requis et {constraintIssues.length} valeur(s) a corriger avant la soumission finale.
          </p>
        </div>
        {firstActionableIssue?.section || firstActionableIssue?.runtimePage ? (
          <button
            type="button"
            onClick={() => focusRequiredField(
              firstActionableIssue.field.name,
              firstActionableIssue.section?.id,
              firstActionableIssue.runtimePage?.id
            )}
            className="rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-300/25"
          >
            Premiere action
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {validationIssueDetails.slice(0, 4).map(({ field, section, runtimePage, type, message }) => {
          const targetTitle = runtimePage?.title || section?.title || 'Etape inconnue';
          const canOpen = Boolean((section && !section.locked) || (runtimePage && !runtimePage.locked));
          return (
            <button
              key={`${field.name}-${type}`}
              type="button"
              disabled={!canOpen}
              onClick={() => focusRequiredField(field.name, section?.id, runtimePage?.id)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                canOpen
                  ? 'border-amber-200/20 bg-slate-950/25 text-amber-50 hover:border-amber-200/40'
                  : 'cursor-not-allowed border-white/8 bg-slate-950/15 text-slate-500 opacity-60'
              }`}
            >
              <p className="truncate text-[10px] font-black uppercase tracking-[0.1em]">
                {targetTitle}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug">
                {field.label}
              </p>
              <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-amber-100/75">
                {message}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

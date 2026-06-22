import React from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, LockKeyhole } from 'lucide-react';
import type { InternalGemField } from './internalKoboFormDefinition';
import type { XlsFormPage } from './xlsFormMobileRuntime';

type InternalKoboFormHeaderProps = {
  activeSectionId: string;
  setActiveSectionId: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  progress: {
    filled: number;
    total: number;
    percent: number;
    missingItems: { name: string; label: string; pageTitle?: string; filled: boolean }[];
  };
  sectionsWithLocks: {
    id: string;
    title: string;
    activeFields: InternalGemField[];
    missingFields: InternalGemField[];
    locked: boolean;
    lockedReason: string;
    blockedBySectionId: string;
  }[];
  selectedRole: string;
  selectedRoleSectionId: string;
  runtimeNavigablePages: {
    id: string;
    title: string;
    subtitle: string;
    activeFields: any[];
    missingFields: any[];
    locked: boolean;
    lockedReason: string;
    blockedByPageId: string;
    fields: any[];
  }[];
  activeRuntimePageId: string;
  setActiveRuntimePageId: (id: string) => void;
  getSectionStatus: (section: any) => any;
  getRuntimePageStatus: (page: any) => any;
  blockedByTitle: (sectionId: string) => string;
  blockedByRuntimeTitle: (pageId: string) => string;
  normalizeQuery: string;
};

export const InternalKoboFormHeader: React.FC<InternalKoboFormHeaderProps> = ({
  activeSectionId,
  setActiveSectionId,
  query,
  setQuery,
  progress,
  sectionsWithLocks,
  selectedRole,
  selectedRoleSectionId,
  runtimeNavigablePages,
  activeRuntimePageId,
  setActiveRuntimePageId,
  getSectionStatus,
  getRuntimePageStatus,
  blockedByTitle,
  blockedByRuntimeTitle,
  normalizeQuery,
}) => {
  const mobileSectionOptions = sectionsWithLocks.filter((section) => !section.locked);
  const mobileRuntimePageOptions = runtimeNavigablePages.filter((page) => !page.locked);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Progress</h4>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              {progress.filled}/{progress.total} ({progress.percent}%)
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
            progress.missingItems.length > 0
              ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
              : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
          }`}>
            {progress.missingItems.length ? `${progress.missingItems.length} a completer` : 'Etape complete'}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Etapes</h4>
          </div>
          <div className="flex-1 flex-wrap gap-2">
            {sectionsWithLocks.map((section) => {
              const status = getSectionStatus(section);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    if (!section.locked) setActiveSectionId(section.id);
                  }}
                  className={`w-full flex items-start justify-between gap-3 rounded-2xl border p-4 space-y-3 shadow-sm ${
                    section.locked
                      ? 'border-white/5 bg-white/[0.02] text-slate-600'
                      : section.missingFields.length > 0
                      ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                      : section.activeFields.length > 0
                      ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                      : 'border-white/8 bg-white/[0.03] text-slate-400'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-black leading-snug text-white">{section.title}</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">
                      {status.detail}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${status.className}`}>
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {runtimeNavigablePages.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Pages</h4>
            </div>
            <div className="flex-1 flex-wrap gap-2">
              {runtimeNavigablePages.map((page) => {
                const status = getRuntimePageStatus(page);
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => {
                      if (!page.locked) setActiveRuntimePageId(page.id);
                    }}
                    className={`w-full flex items-start justify-between gap-3 rounded-2xl border p-4 space-y-3 shadow-sm ${
                      page.locked
                        ? 'border-white/5 bg-white/[0.02] text-slate-600'
                        : page.missingFields.length > 0
                        ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                        : page.activeFields.length > 0
                        ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                        : 'border-white/8 bg-white/[0.03] text-slate-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-black leading-snug text-white">{page.title}</p>
                      {page.subtitle && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {page.subtitle}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${status.className}`}>
                      {status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
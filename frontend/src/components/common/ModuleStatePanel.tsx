import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FolderOpen, Loader2 } from 'lucide-react';

type ModuleStateTone = 'info' | 'error' | 'loading';

interface ModuleStatePanelProps {
  title: string;
  description: string;
  tone?: ModuleStateTone;
  actionLabel?: string;
  actionTo?: string;
  className?: string;
}

const toneStyles: Record<ModuleStateTone, string> = {
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-100',
  error: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
  loading: 'border-slate-700/60 bg-slate-900/70 text-slate-100',
};

export function ModuleStatePanel({
  title,
  description,
  tone = 'info',
  actionLabel,
  actionTo,
  className = '',
}: ModuleStatePanelProps) {
  const icon =
    tone === 'loading' ? (
      <Loader2 size={20} className="animate-spin" />
    ) : tone === 'error' ? (
      <AlertCircle size={20} />
    ) : (
      <FolderOpen size={20} />
    );

  return (
    <div className={`flex min-h-[50vh] items-center justify-center px-4 py-10 ${className}`.trim()}>
      <div
        className={`w-full max-w-3xl rounded-[2rem] border px-6 py-8 shadow-2xl ${toneStyles[tone]}`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-current/10 bg-slate-950/30">
            {icon}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] opacity-80">
              Etat du module
            </p>
            <h2 className="text-xl font-black text-white">{title}</h2>
            <p className="max-w-2xl text-sm leading-relaxed opacity-90">{description}</p>
            {actionLabel && actionTo ? (
              <Link
                to={actionTo}
                className="inline-flex rounded-2xl border border-current/20 bg-slate-950/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-950/60"
              >
                {actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

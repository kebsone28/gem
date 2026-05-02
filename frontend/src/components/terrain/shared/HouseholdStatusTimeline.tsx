 
import React from 'react';
import { HouseholdStatusLabel } from './HouseholdStatusLabel';

export interface StatusStage {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface HouseholdStatusTimelineProps {
  currentStatus?: string;
  updatedAt?: string;
  isAdmin?: boolean;
  onEdit?: (status: string) => void;
  // TODO: `stages` will be mapped here for the actual visual timeline later
  stages?: StatusStage[];
}

export const HouseholdStatusTimeline: React.FC<HouseholdStatusTimelineProps> = React.memo(({
  currentStatus,
  updatedAt,
  isAdmin = false,
  onEdit,
  stages = []
}) => {
  const normalizedStatus = String(currentStatus || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const effectiveStages =
    stages.length > 0
      ? stages
      : [
          { label: 'Non encore installee', value: 'Non encore installée' },
          { label: 'Livraison effectuee', value: 'Livraison effectuée' },
          { label: 'Murs termines', value: 'Murs terminés' },
          { label: 'Reseau termine', value: 'Réseau terminé' },
          { label: 'Interieur termine', value: 'Intérieur terminé' },
          { label: 'Controle conforme', value: 'Contrôle conforme' },
        ];

  const currentIndex = effectiveStages.findIndex(
    (stage) =>
      stage.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim() === normalizedStatus
  );

  const activeStage = currentIndex >= 0 ? effectiveStages[currentIndex] : null;

  return (
    <div className="p-6 sm:p-8 rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] border border-white/10 shadow-inner">
      <h4 className="text-[10px] font-black uppercase tracking-[0.28em] mb-6 text-slate-300/70">
        GLOBAL STATUS TRACKING
      </h4>

      <div className="flex items-center justify-between gap-4">
        <HouseholdStatusLabel currentStatus={currentStatus} updatedAt={updatedAt} />

        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(currentStatus || 'UNKNOWN')}
            title="Changer l'état global du ménage"
            className="px-5 py-3 bg-slate-950/25 text-slate-100 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] shadow-inner hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-95"
          >
            Modifier
          </button>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {effectiveStages.map((stage, index) => {
          const isCompleted = currentIndex >= 0 && index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={stage.value}
              className={`relative rounded-[1.6rem] border p-5 transition-all duration-300 ${
                isCurrent
                  ? 'border-emerald-400/40 bg-emerald-500/10 shadow-[0_10px_30px_rgba(16,185,129,0.12)] ring-1 ring-emerald-400/20'
                  : isCompleted
                    ? 'border-sky-400/20 bg-sky-500/10'
                    : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              {/* Ligne de connexion verticale entre les étapes */}
              {index < effectiveStages.length - 1 && (
                <div className="absolute left-[34px] top-[60px] bottom-[-20px] w-px bg-gradient-to-b from-white/10 to-transparent z-0" />
              )}

              <div className="flex items-start gap-5 relative z-10">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-[14px] font-black transition-all ${
                    isCurrent
                      ? 'border-emerald-400/50 bg-emerald-500/25 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                      : isCompleted
                        ? 'border-sky-400/30 bg-sky-500/20 text-sky-200'
                        : 'border-white/10 bg-white/[0.05] text-slate-500'
                  }`}
                >
                  {stage.icon || index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p
                      className={`text-[12px] font-black uppercase tracking-[0.12em] leading-none ${
                        isCurrent
                          ? 'text-emerald-300'
                          : isCompleted
                            ? 'text-sky-200'
                            : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] border ${
                        isCurrent
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isCompleted
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            : 'bg-white/5 text-slate-500 border-white/10'
                      }`}
                    >
                      {isCurrent ? 'Étape Actuelle' : isCompleted ? 'Validé' : 'En attente'}
                    </span>
                  </div>

                  {stage.description && (
                    <p className={`text-[11px] leading-relaxed transition-colors ${isCurrent ? 'text-slate-200' : 'text-slate-500'}`}>
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeStage?.description ? (
        <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-black/15 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
            Focus étape courante
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-200">
            {activeStage.description}
          </p>
        </div>
      ) : null}
    </div>
  );
});

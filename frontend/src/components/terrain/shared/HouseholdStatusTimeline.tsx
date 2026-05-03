 
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
  const completedCount = currentIndex >= 0 ? currentIndex + 1 : 0;
  const progressPercent = effectiveStages.length > 1
    ? Math.max(0, Math.min(100, (completedCount / effectiveStages.length) * 100))
    : 0;

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-4 shadow-inner sm:rounded-[2rem] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300/70 sm:text-[10px] sm:tracking-[0.26em]">
            Avancement terrain
          </h4>
          <div className="mt-3">
            <HouseholdStatusLabel currentStatus={currentStatus} updatedAt={updatedAt} />
          </div>
        </div>

        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(currentStatus || 'UNKNOWN')}
            title="Changer l'état global du ménage"
            className="h-10 shrink-0 rounded-2xl border border-white/10 bg-slate-950/30 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-100 shadow-inner transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95 sm:h-11 sm:px-4 sm:text-[10px]"
          >
            Modifier
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          <span>{completedCount}/{effectiveStages.length} étapes</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.35)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:gap-3">
        {effectiveStages.map((stage, index) => {
          const isCompleted = currentIndex >= 0 && index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={stage.value}
              className={`relative rounded-[1.25rem] border p-3.5 transition-all duration-300 sm:rounded-[1.45rem] sm:p-4 ${
                isCurrent
                  ? 'border-emerald-400/40 bg-emerald-500/10 shadow-[0_10px_30px_rgba(16,185,129,0.12)] ring-1 ring-emerald-400/20'
                  : isCompleted
                    ? 'border-sky-400/20 bg-sky-500/10'
                    : 'border-white/[0.07] bg-white/[0.035]'
              }`}
            >
              {/* Ligne de connexion verticale entre les étapes */}
              {index < effectiveStages.length - 1 && (
                <div className="absolute left-[25px] top-[48px] bottom-[-14px] z-0 w-px bg-gradient-to-b from-white/10 to-transparent sm:left-[29px] sm:top-[52px]" />
              )}

              <div className="relative z-10 flex items-start gap-3 sm:gap-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border text-[13px] font-black transition-all sm:h-10 sm:w-10 sm:rounded-2xl ${
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
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`min-w-0 text-[10px] font-black uppercase leading-snug tracking-[0.09em] sm:text-[11px] sm:tracking-[0.12em] ${
                        isCurrent
                          ? 'text-emerald-300'
                          : isCompleted
                            ? 'text-sky-200'
                            : 'text-slate-300/75'
                      }`}
                    >
                      {stage.label}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] sm:px-2.5 sm:py-1 sm:text-[8px] ${
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
                    <p className={`mt-1.5 text-[10px] leading-relaxed transition-colors sm:text-[11px] ${isCurrent ? 'text-slate-200' : 'text-slate-500'}`}>
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
        <div className="mt-4 rounded-[1.25rem] border border-white/[0.08] bg-black/15 p-3.5 sm:mt-5 sm:rounded-[1.5rem] sm:p-4">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400 sm:text-[9px]">
            Focus étape courante
          </p>
          <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-200 sm:text-sm">
            {activeStage.description}
          </p>
        </div>
      ) : null}
    </div>
  );
});

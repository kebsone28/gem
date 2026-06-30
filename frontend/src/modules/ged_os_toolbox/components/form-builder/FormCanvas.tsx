/**
 * FormCanvas — Zone de depot et liste de questions du Form Builder
 * Extraite de ToolboxSubmissions.tsx
 */
import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Layers,
  MousePointer2,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import type {
  BuilderLanguage,
  BuilderQuestion,
  BuilderQuestionType,
  BuilderDropPosition,
  BuilderFieldPaletteItem,
} from './types';
import { builderFieldPalette, builderQuestionTypeLabel } from './constants';
import { getBuilderQuestionLabel, getBuilderQuestionHint } from './hooks';

interface DropTarget {
  id: string;
  position: BuilderDropPosition;
}

interface FormCanvasProps {
  questions: BuilderQuestion[];
  selectedQuestionId: string;
  builderLanguage: BuilderLanguage;
  dropTarget: DropTarget | null;
  draggingLabel: string;
  onSelectQuestion: (id: string) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>, targetId: string) => void;
  onDrop: (event: React.DragEvent<HTMLElement>, targetId: string) => void;
  onCanvasDrop: (event: React.DragEvent<HTMLElement>) => void;
  onQuestionDragStart: (event: React.DragEvent<HTMLElement>, question: BuilderQuestion) => void;
  onQuestionDragEnd: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddAfter: (id: string, type: BuilderQuestionType) => void;
  onDelete: (id: string) => void;
  onSetDropTarget: (target: DropTarget | null) => void;
}

export const FormCanvas: React.FC<FormCanvasProps> = ({
  questions,
  selectedQuestionId,
  builderLanguage,
  dropTarget,
  draggingLabel,
  onSelectQuestion,
  onDragOver,
  onDrop,
  onCanvasDrop,
  onQuestionDragStart,
  onQuestionDragEnd,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onAddAfter,
  onDelete,
  onSetDropTarget,
}) => {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onCanvasDrop}
      className="rounded-2xl border border-slate-200 bg-white p-3"
    >
      <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Formulaire
          </p>
          <p className="text-xs font-semibold text-slate-500">
            {questions.length} champ(s) -{' '}
            {draggingLabel ? `Depot en cours: ${draggingLabel}` : 'glisser/deposer active'}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
          <MousePointer2 size={13} />
          Drag/drop
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-8 text-center">
          <div>
            <Layers size={34} className="mx-auto text-blue-500" />
            <p className="mt-3 text-sm font-black text-slate-900">Deposez un champ ici</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Le formulaire se construit comme dans Kobo: bibliotheque, pile, parametres.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((question, index) => {
            const active = selectedQuestionId === question.id;
            const paletteItem: BuilderFieldPaletteItem | undefined = builderFieldPalette.find(
              (item) => item.type === question.type
            );
            const Icon = paletteItem?.icon || Type;
            const dropBefore = dropTarget?.id === question.id && dropTarget.position === 'before';
            const dropAfter = dropTarget?.id === question.id && dropTarget.position === 'after';

            return (
              <article
                key={question.id}
                onDragOver={(event) => onDragOver(event, question.id)}
                onDrop={(event) => onDrop(event, question.id)}
                onDragLeave={() =>
                  onSetDropTarget(dropTarget?.id === question.id ? null : dropTarget)
                }
                className="relative"
              >
                {dropBefore ? (
                  <div className="mb-2 h-1 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.7)]" />
                ) : null}
                <div
                  className={`grid w-full grid-cols-[44px_54px_1fr_auto] items-stretch overflow-hidden rounded-xl border text-left transition-all ${
                    active
                      ? 'border-blue-400 bg-blue-50 shadow-sm ring-4 ring-blue-100'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Drag handle */}
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => onQuestionDragStart(event, question)}
                    onDragEnd={onQuestionDragEnd}
                    onClick={(event) => event.stopPropagation()}
                    className="grid cursor-grab place-items-center border-r border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing"
                    aria-label="Glisser pour deplacer"
                    title="Glisser pour deplacer"
                  >
                    <GripVertical size={18} />
                  </button>

                  {/* Icon */}
                  <span className="grid place-items-center border-r border-slate-200 bg-slate-50">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                      <Icon size={16} />
                    </span>
                  </span>

                  {/* Content */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectQuestion(question.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') onSelectQuestion(question.id);
                    }}
                    className="min-w-0 p-4"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-black text-slate-950">
                        {question.required ? '* ' : ''}
                        {getBuilderQuestionLabel(question, builderLanguage) ||
                          `Question ${index + 1}`}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                        {builderQuestionTypeLabel[question.type]}
                      </span>
                      {question.relevant ? (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-violet-700">
                          Condition
                        </span>
                      ) : null}
                      {question.calculation ? (
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-700">
                          Calcul
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-slate-500">
                      {question.name}{' '}
                      {getBuilderQuestionHint(question, builderLanguage)
                        ? `- ${getBuilderQuestionHint(question, builderLanguage)}`
                        : ''}
                    </span>
                  </span>

                  {/* Actions */}
                  <span className="flex items-center gap-1 pr-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveUp(question.id);
                      }}
                      disabled={index === 0}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700 disabled:opacity-30"
                      aria-label="Monter"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveDown(question.id);
                      }}
                      disabled={index === questions.length - 1}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700 disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(question.id);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700"
                      aria-label="Dupliquer"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddAfter(question.id, 'text');
                      }}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700"
                      aria-label="Ajouter apres"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(question.id);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
                {dropAfter ? (
                  <div className="mt-2 h-1 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.7)]" />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

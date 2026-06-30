/**
 * FieldPalette — Palette de types de champs pour le Form Builder
 * Extraite de ToolboxSubmissions.tsx
 */
import React from 'react';
import type { BuilderQuestionType } from './types';
import { builderFieldPalette } from './constants';
import type { BuilderFieldPaletteItem } from './types';

interface FieldPaletteProps {
  onAddQuestion: (type: BuilderQuestionType) => void;
  onDragStart: (
    event: React.DragEvent<HTMLElement>,
    type: BuilderQuestionType,
    label: string
  ) => void;
  onDragEnd: () => void;
}

export const FieldPalette: React.FC<FieldPaletteProps> = ({
  onAddQuestion,
  onDragStart,
  onDragEnd,
}) => {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
      {builderFieldPalette.map((item: BuilderFieldPaletteItem) => {
        const Icon = item.icon;
        return (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(event) => onDragStart(event, item.type, item.label)}
            onDragEnd={onDragEnd}
            onClick={() => onAddQuestion(item.type)}
            className="group flex min-h-[62px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
            title="Glisser dans le formulaire ou cliquer pour ajouter"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200">
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-black leading-tight text-slate-900">
                {item.label}
              </span>
              <span className="mt-1 block text-[10px] font-semibold leading-snug text-slate-500">
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

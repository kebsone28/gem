/**
 * 🔍 DiffViewer - Composant de visualisation des différences
 * Affiche côte à côte la réponse actuelle et la réponse de référence
 */

import React, { useMemo, useCallback } from 'react';
import { normalizeComparableText, toComparableLines } from '@utils/ai';

interface DiffRow {
  id: string;
  current: string;
  reference: string;
}

interface DiffViewerProps {
  current?: string;
  reference?: string;
  className?: string;
}

function buildDiffRows(current = '', reference = ''): DiffRow[] {
  const currentLines = toComparableLines(current);
  const referenceLines = toComparableLines(reference);
  const maxLength = Math.max(currentLines.length, referenceLines.length);

  return Array.from({ length: maxLength }, (_, index) => ({
    id: `diff-${index}`,
    current: currentLines[index] || '',
    reference: referenceLines[index] || '',
  }));
}

export default function DiffViewer({ current, reference, className = '' }: DiffViewerProps) {
  const diffRows = useMemo(
    () => buildDiffRows(current, reference),
    [current, reference]
  );

  const changedDiffRows = useMemo(
    () =>
      diffRows.filter(
        (row) => normalizeComparableText(row.current) !== normalizeComparableText(row.reference)
      ),
    [diffRows]
  );

  const isRowChanged = useCallback((row: DiffRow) =>
    normalizeComparableText(row.current) !== normalizeComparableText(row.reference),
    []
  );

  const emptyState = useMemo(() => (
    <div className="rounded-2xl border border-white/8 bg-slate-900/50 p-6 text-center">
      <p className="text-sm text-slate-500">Aucune différence à afficher</p>
    </div>
  ), []);

  if (diffRows.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={`rounded-2xl border border-white/8 bg-slate-900/50 overflow-hidden ${className}`}>
      <div className="grid grid-cols-2 border-b border-white/8 bg-slate-950/50">
        <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 border-r border-white/8">
          Réponse actuelle
        </div>
        <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
          Réponse de référence
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {diffRows.map((row) => (
          <div
            key={row.id}
            className={`grid grid-cols-2 border-b border-white/5 ${isRowChanged(row) ? 'bg-amber-500/5' : ''}`}
          >
            <div className="px-4 py-2 text-xs text-slate-300 border-r border-white/5 font-mono">
              {row.current || <span className="text-slate-600">vide</span>}
            </div>
            <div className="px-4 py-2 text-xs text-cyan-100 font-mono">
              {row.reference || <span className="text-slate-600">vide</span>}
            </div>
          </div>
        ))}
      </div>
      {changedDiffRows.length > 0 && (
        <div className="px-4 py-3 bg-slate-950/50 border-t border-white/8">
          <p className="text-[10px] text-amber-400 font-semibold">
            {changedDiffRows.length} ligne(s) modifiée(s)
          </p>
        </div>
      )}
    </div>
  );
}

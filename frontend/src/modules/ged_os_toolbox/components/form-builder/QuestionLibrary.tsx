/**
 * QuestionLibrary — Bibliotheque de blocs de questions réutilisables
 * Extraite de ToolboxSubmissions.tsx
 */
import React, { useState, useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { builderQuestionLibrary } from './constants';

interface QuestionLibraryProps {
  onInsertBlock: (blockKey: string) => void;
}

export const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onInsertBlock }) => {
  const [query, setQuery] = useState('');

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return builderQuestionLibrary;
    return builderQuestionLibrary.filter((block) =>
      `${block.title} ${block.description}`.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Bibliotheque de questions
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Blocs reutilisables comme Kobo Library, inseres dans la pile drag/drop.
          </p>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher un bloc..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 sm:w-56"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {filteredLibrary.map((block) => (
          <button
            key={block.key}
            type="button"
            onClick={() => onInsertBlock(block.key)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
              <BookOpen size={14} />
              {block.title}
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-500">
              {block.description}
            </span>
            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">
              +{block.questions.length} champ(s)
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

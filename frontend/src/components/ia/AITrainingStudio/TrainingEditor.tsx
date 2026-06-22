/**
 * ✏️ TrainingEditor - Composant d'édition pour l'entraînement IA
 * Zone de travail principale avec question, réponse et actions
 */

import React from 'react';
import { BookOpen, Copy, Loader2, Save, Search } from 'lucide-react';
import type { AIResponse } from '@services/ai/MissionSageService';
import WorkflowStepper from './WorkflowStepper';

interface TrainingEditorProps {
  question: string;
  onQuestionChange: (value: string) => void;
  referenceAnswer: string;
  onReferenceAnswerChange: (value: string) => void;
  currentResponse: AIResponse | null;
  isPreviewing: boolean;
  isSaving: boolean;
  isTestingReplacement: boolean;
  feedback: string | null;
  error: string | null;
  onPreview: () => void;
  onUseCurrentAsBase: () => void;
  onSave: () => void;
  onTestReplacement: () => void;
}

export default function TrainingEditor({
  question,
  onQuestionChange,
  referenceAnswer,
  onReferenceAnswerChange,
  currentResponse,
  isPreviewing,
  isSaving,
  isTestingReplacement,
  feedback,
  error,
  onPreview,
  onUseCurrentAsBase,
  onSave,
  onTestReplacement,
}: TrainingEditorProps) {
  return (
    <section className="rounded-[1.5rem] border border-white/8 bg-white/[0.025] p-4 sm:p-5">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Question de test
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
              Override actif
            </span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
              Correspondance exacte
            </span>
          </div>
        </div>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          rows={3}
          placeholder="Ex : Le coffret compteur est posé à l'intérieur de la concession. Est-ce certifiable ?"
          className="w-full bg-slate-900 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        <WorkflowStepper />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={onPreview}
            disabled={!question.trim() || isPreviewing}
            className="inline-flex w-full items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[10px] font-black text-cyan-100">
              1
            </span>
            {isPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Réponse actuelle
          </button>
          <button
            onClick={onUseCurrentAsBase}
            disabled={!currentResponse?.message}
            className="inline-flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-black text-white">
              2
            </span>
            <Copy size={14} />
            Reprendre la réponse actuelle
          </button>
          <button
            onClick={onSave}
            disabled={!question.trim() || !referenceAnswer.trim() || isSaving}
            className="inline-flex w-full items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-black text-emerald-100">
              3
            </span>
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Mémoriser la correction
          </button>
          <button
            onClick={onTestReplacement}
            disabled={!question.trim() || !referenceAnswer.trim() || isTestingReplacement}
            className="p-4 bg-slate-950/40 dark:bg-slate-900/50 rounded-xl border border-slate-800 dark:border-slate-800 inline-flex w-full items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-blue-200 transition-colors hover:bg-blue-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300/20 bg-blue-300/10 text-[10px] font-black text-blue-100">
              4
            </span>
            {isTestingReplacement ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <BookOpen size={14} />
            )}
            Tester le remplacement
          </button>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {feedback}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
            {error}
          </div>
        )}
        <p className="text-xs leading-6 text-slate-500">
          Le remplacement s'applique actuellement sur la question normalisée exacte.
          Les formulations proches restent indépendantes.
        </p>
      </div>
    </section>
  );
}

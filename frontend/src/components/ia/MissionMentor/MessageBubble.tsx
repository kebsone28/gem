/**
 * 💬 MessageBubble - Composant de bulle de message pour le chat IA
 * Affiche un message utilisateur ou IA avec styling approprié et métadonnées enrichies
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, ShieldAlert, X, BookOpen, AlertTriangle, ListOrdered, ThumbsUp, ThumbsDown, Zap, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import AIPremiumMessage from '../AIPremiumMessage';
import type { AIResponse } from '../../../services/ai/MissionSageService';
import { formatReferences, formatRisks, formatProcedureSteps } from '../../../services/ai/responseEnricher';

interface MessageBubbleProps {
  response: AIResponse;
  isMaximized?: boolean;
  onFeedback?: (rating: 'positive' | 'negative' | 'neutral', reason?: string) => void;
  onActionExecute?: (suggestion: any) => void;
}

export default function MessageBubble({ response, isMaximized = false, onFeedback, onActionExecute }: MessageBubbleProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showFeedbackButtons, setShowFeedbackButtons] = useState(false);
  const verdictBadgeClass = (verdict?: AIResponse['verdict']) => {
    switch (verdict) {
      case 'Conforme':
      case 'Conforme sous réserve':
        return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
      case 'Non conforme':
        return 'border-rose-500/30 bg-rose-500/15 text-rose-300';
      case 'A verifier':
        return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
      default:
        return 'border-white/10 bg-white/5 text-slate-300';
    }
  };

  const verdictAccentClass = (verdict?: AIResponse['verdict']) => {
    switch (verdict) {
      case 'Conforme':
      case 'Conforme sous réserve':
        return 'from-emerald-400/70 to-emerald-500/10';
      case 'Non conforme':
        return 'from-rose-400/80 to-rose-500/10';
      case 'A verifier':
        return 'from-amber-400/80 to-amber-500/10';
      default:
        return 'from-blue-400/50 to-transparent';
    }
  };

  const severityAccentClass = (severity?: AIResponse['severity']) => {
    switch (severity) {
      case 'critique':
        return 'shadow-[0_0_0_1px_rgba(244,63,94,0.22),0_18px_50px_-24px_rgba(244,63,94,0.45)]';
      case 'majeure':
        return 'shadow-[0_0_0_1px_rgba(249,115,22,0.18),0_18px_50px_-24px_rgba(249,115,22,0.35)]';
      case 'mineure':
        return 'shadow-[0_0_0_1px_rgba(14,165,233,0.18),0_18px_50px_-24px_rgba(14,165,233,0.35)]';
      default:
        return '';
    }
  };

  const severityBadgeClass = (severity?: AIResponse['severity']) => {
    switch (severity) {
      case 'critique':
        return 'border-rose-500/30 bg-rose-500/15 text-rose-300';
      case 'majeure':
        return 'border-orange-500/30 bg-orange-500/15 text-orange-300';
      case 'mineure':
        return 'border-sky-500/30 bg-sky-500/15 text-sky-300';
      case 'information':
        return 'border-blue-500/30 bg-blue-500/15 text-blue-300';
      default:
        return 'border-white/10 bg-white/5 text-slate-300';
    }
  };

  const VerdictIcon = (verdict?: AIResponse['verdict']) => {
    switch (verdict) {
      case 'Conforme':
      case 'Conforme sous réserve':
        return ShieldAlert;
      case 'Non conforme':
        return ShieldAlert;
      case 'A verifier':
        return Info;
      default:
        return Info;
    }
  };

  const SeverityIcon = (severity?: AIResponse['severity']) => {
    switch (severity) {
      case 'critique':
      case 'majeure':
        return X;
      case 'mineure':
      case 'information':
        return Info;
      default:
        return Info;
    }
  };

  const controlSheetEntries = (sheet?: AIResponse['controlSheet']) =>
    [
      { key: 'observation', label: 'Observation', value: sheet?.observation },
      { key: 'referenceRule', label: 'Regle de reference', value: sheet?.referenceRule },
      { key: 'mainRisk', label: 'Risque principal', value: sheet?.mainRisk },
      { key: 'immediateAction', label: 'Action immediate', value: sheet?.immediateAction },
    ].filter((entry) => Boolean(entry.value));

  return (
    <motion.div
      initial={{ opacity: 0, x: response.type === 'user' ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 sm:p-5 rounded-[1.4rem] sm:rounded-[2rem] border relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
        response.type === 'user'
          ? `bg-slate-800 border-slate-700 text-slate-200 ${isMaximized ? 'ml-auto mr-0 sm:mr-4 max-w-[92%] sm:max-w-[85%]' : 'ml-0 sm:ml-12'} rounded-tr-none shadow-md`
          : response.type === 'warning'
            ? `bg-amber-950 border-amber-500/30 text-amber-100 ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
            : response.type === 'error'
              ? `bg-rose-950 border-rose-500/30 text-rose-100 ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
              : `bg-[#0a192e] border-blue-500/30 text-blue-50 shadow-xl ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
      } ${response.type !== 'user' ? severityAccentClass(response.severity) : ''}`}
    >
      {response.type !== 'user' && (response.verdict || response.severity) && (
        <div
          className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${verdictAccentClass(response.verdict)}`}
        />
      )}
      <div className="flex gap-4 items-start">
        {response.type !== 'user' && (
          <div
            className={`p-2 rounded-xl border ${
              response.type === 'warning'
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                : response.type === 'error'
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : 'bg-blue-600/20 border-blue-600/30 text-blue-400'
            }`}
          >
            {response.type === 'warning' ? (
              <ShieldAlert size={16} />
            ) : response.type === 'error' ? (
              <X size={16} />
            ) : (
              <Info size={16} />
            )}
          </div>
        )}
        <div className="flex-1 space-y-4">
          {(response.verdict || response.severity) && (
            <div className="flex flex-wrap gap-2">
              {response.verdict && (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${verdictBadgeClass(response.verdict)}`}
                >
                  {(() => {
                    const Icon = VerdictIcon(response.verdict);
                    return <Icon size={12} className="mr-1.5" />;
                  })()}
                  {response.verdict}
                </span>
              )}
              {response.severity && (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${severityBadgeClass(response.severity)}`}
                >
                  {(() => {
                    const Icon = SeverityIcon(response.severity);
                    return <Icon size={12} className="mr-1.5" />;
                  })()}
                  {response.severity}
                </span>
              )}
            </div>
          )}
          {response.type === 'user' ? (
            <p className="text-[13px] font-bold leading-7 whitespace-pre-wrap italic text-slate-100">
              {response.message}
            </p>
          ) : (
            <AIPremiumMessage message={response.message} />
          )}

          {/* Boutons de feedback utilisateur */}
          {response.type !== 'user' && onFeedback && (
            <div className="flex items-center gap-2 mt-3">
              {showFeedbackButtons ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFeedbackGiven('positive');
                      onFeedback('positive');
                      setShowFeedbackButtons(false);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      feedbackGiven === 'positive'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 border border-transparent'
                    }`}
                    title="Cette réponse est utile"
                  >
                    <ThumbsUp size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setFeedbackGiven('negative');
                      onFeedback('negative');
                      setShowFeedbackButtons(false);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      feedbackGiven === 'negative'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent'
                    }`}
                    title="Cette réponse n'est pas utile"
                  >
                    <ThumbsDown size={14} />
                  </button>
                  <button
                    onClick={() => setShowFeedbackButtons(false)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowFeedbackButtons(true)}
                  className="p-2 rounded-lg bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-400 transition-all border border-slate-700/50"
                  title="Noter cette réponse"
                >
                  <ThumbsUp size={14} />
                </button>
              )}
            </div>
          )}

          {response.controlSheet && controlSheetEntries(response.controlSheet).length > 0 && (
            <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                  Fiche de controle terrain
                </p>
                {response._engine === 'VISION' && (
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Vision assistee
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {controlSheetEntries(response.controlSheet).map((entry) => (
                  <div
                    key={entry.key}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {entry.label}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-100">
                      {entry.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response.recommendedAction &&
            response.recommendedAction !== response.controlSheet?.immediateAction && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  Action recommandee
                </p>
                <p className="mt-2 text-[12px] font-semibold leading-relaxed text-cyan-50">
                  {response.recommendedAction}
                </p>
              </div>
            )}

          {/* Affichage des références normatives enrichies */}
          {response.referencesCitees && response.referencesCitees.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 flex items-center gap-2">
                <BookOpen size={12} />
                References normatives
              </p>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-emerald-50">
                {formatReferences(response.referencesCitees)}
              </p>
            </div>
          )}

          {/* Affichage des risques identifiés */}
          {response.risquesIdentifies && response.risquesIdentifies.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300 flex items-center gap-2">
                <AlertTriangle size={12} />
                Risques identifies
              </p>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-rose-50">
                {formatRisks(response.risquesIdentifies)}
              </p>
            </div>
          )}

          {/* Affichage des étapes de procédure */}
          {response.etapesProcedure && response.etapesProcedure.length > 0 && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 flex items-center gap-2">
                <ListOrdered size={12} />
                Etapes de procedure
              </p>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-blue-50 whitespace-pre-line">
                {formatProcedureSteps(response.etapesProcedure)}
              </p>
            </div>
          )}

          {/* Affichage du domaine technique */}
          {response.domaine && (
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-purple-300">
                Domaine: {response.domaine}
              </p>
            </div>
          )}

          {response.images && response.images.length > 0 && (
            <div className="grid gap-4 mt-2">
              {response.images.map((img, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-white/10 bg-black/50 p-1"
                >
                  <img
                    src={img.url}
                    alt={img.caption}
                    className="w-full object-contain rounded-lg max-h-64"
                  />
                  <p className="text-[10px] text-center text-slate-400 mt-2 italic px-2">
                    {img.caption}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {response.actionLabel && (
        <div className="mt-4 flex gap-3">
          {response.actionType === 'download_report' ? (
            <button
              onClick={async () => {
                // Handle report download
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg shadow-blue-600/20 transition-all text-white"
            >
              {response.actionLabel}
            </button>
          ) : (
            <a
              href={response.actionPath}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/5 transition-all text-blue-400"
            >
              {response.actionLabel}
            </a>
          )}
        </div>
      )}

      {response.smartReplies && response.smartReplies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {response.smartReplies.map((sr: string, idx: number) => (
            <button
              key={idx}
              onClick={() => {
                // Handle smart reply
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-blue-500/20 text-blue-300 text-[10px] font-bold tracking-wide rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors"
            >
              {sr}
            </button>
          ))}
        </div>
      )}

      {/* Suggestions d'actions (ex-Copilote) */}
      {response.suggestions && response.suggestions.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-blue-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Actions recommandées</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            {response.suggestions.map((s) => (
              <div key={s.id} className="bg-black/30 border border-white/10 p-4 rounded-[1.25rem] space-y-3 shadow-inner">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-xl border ${
                    s.severity === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    s.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    {s.id.includes('sync') ? <RefreshCw size={14} className="animate-spin-slow" /> : 
                     s.id.includes('plan') ? <Zap size={14} /> : 
                     <Sparkles size={14} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-white uppercase tracking-widest">{s.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onActionExecute?.(s)}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                    s.severity === 'success' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white shadow-emerald-900/10' :
                    s.severity === 'warning' ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white shadow-amber-900/10' :
                    'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white shadow-blue-900/10'
                  }`}
                >
                  <CheckCircle2 size={12} />
                  Approuver et Exécuter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

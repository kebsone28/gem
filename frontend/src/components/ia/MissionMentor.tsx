/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  Sparkles,
  X,
  BookOpen,
  Info,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Search,
  Heart,
  Mic,
  Camera,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import type { AIResponse, RegionalSummary } from '../../services/ai/MissionSageService';
import { missionSageService } from '../../services/ai/MissionSageService';
import { wordReportService } from '../../services/ai/WordReportService';
import { analyzeDG } from '../../services/ai/DecisionEngine';
import type { MissionStats } from '../../services/missionStatsService';
import logger from '../../utils/logger';
import type { AuditLog, Household, Team } from '../../utils/types';
import AIEngineAdminPanel from './AIEngineAdminPanel';
import AIPremiumMessage from './AIPremiumMessage';
import AITrainingStudio from './AITrainingStudio';
import { isMasterAdminEmail } from '../../utils/roleUtils';

interface MissionMentorProps {
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
  teams: Team[];
  regionalSummaries: RegionalSummary[];
}

/**
 * COMPOSANT : MissionMentor (GEM-MINT) 🛡️🕌🤖
 * Le Guide Intelligent de la plateforme PROQUELEC.
 * Sagesse, Respect, Sécurité et Direction Sécure.
 */
export const MissionMentor: React.FC<MissionMentorProps> = ({
  stats,
  auditLogs,
  households,
  teams,
  regionalSummaries,
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isTrainingStudioOpen, setIsTrainingStudioOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiState = React.useMemo(
    () => ({
      stats,
      auditLogs,
      households,
      teams,
      regionalSummaries,
    }),
    [stats, auditLogs, households, teams, regionalSummaries]
  );
  const canManageAI =
    user?.role === 'ADMIN_PROQUELEC' || user?.role === 'ADMIN' || isMasterAdminEmail(user?.email);

  const speakResponse = (message: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const pureText = message.replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]|\*/gu, '');
    const utterance = new SpeechSynthesisUtterance(pureText);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

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
        return ShieldCheck;
      case 'Non conforme':
        return ShieldAlert;
      case 'A verifier':
        return Search;
      default:
        return Info;
    }
  };

  const SeverityIcon = (severity?: AIResponse['severity']) => {
    switch (severity) {
      case 'critique':
      case 'majeure':
        return TriangleAlert;
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

  // Auto-scroll à chaque nouveau message - ajusté pour montrer le début du message IA
  useEffect(() => {
    if (scrollRef.current && history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (lastMessage.type !== 'user') {
        // Pour les messages IA, scroll pour montrer le début du message avec un délai
        setTimeout(() => {
          if (scrollRef.current) {
            const container = scrollRef.current;
            const lastMessageElement = container.lastElementChild as HTMLElement;
            if (lastMessageElement) {
              const containerRect = container.getBoundingClientRect();
              const messageRect = lastMessageElement.getBoundingClientRect();
              const scrollTop = container.scrollTop + (messageRect.top - containerRect.top) - 40; // 40px de marge pour la première ligne
              container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
            }
          }
        }, 200);
      } else {
        // Pour les messages utilisateur, scroll vers le bas
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }
        }, 100);
      }
    }
  }, [history]);

  // EFFET PROACTIF (S'active à l'ouverture si pas d'historique)
  useEffect(() => {
    if (isOpen && history.length === 0 && user && (stats || auditLogs.length > 0)) {
      const checkProactive = async () => {
        setIsThinking(true);
        try {
          const msg = await missionSageService.getProactiveMessage(user, aiState);
          if (msg) setHistory([msg]);
        } catch (err) {
          logger.warn('[MissionMentor] Proactive message unavailable', err);
        } finally {
          setIsThinking(false);
        }
      };
      checkProactive();
    }
  }, [aiState, auditLogs.length, history.length, isOpen, stats, user]);

  const handleSend = async () => {
    if (!query.trim() || !user) return;

    setIsThinking(true);
    const originalQuery = query;
    setQuery('');

    // Afficher directement le message de l'utilisateur
    setHistory((prev) => [...prev, { message: originalQuery, type: 'user' } as AIResponse]);

    try {
      const resp = await missionSageService.processQuery(originalQuery, user, aiState);
      setHistory((prev) => [...prev, resp]);
      speakResponse(resp.message);
    } catch (err: any) {
      logger.error('[MissionMentor] Error processing query', err);
      setHistory((prev) => [
        ...prev,
        {
          message:
            "Désolé, une erreur technique a empêché la réponse. Vérifiez votre connexion ou la configuration de l'IA.",
          type: 'error',
        } as AIResponse,
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      setIsThinking(true);
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        // On affiche d'abord l'image dans le chat
        setHistory((prev) => [
          ...prev,
          {
            message: "Analyse visuelle de l'installation en cours...",
            type: 'user',
            images: [{ url: base64, caption: 'Scan Oculaire Transmis' }],
          } as AIResponse,
        ]);

        try {
          const resp = await missionSageService.processQuery(
            'Analyse cette photo pour audit technique.',
            user!,
            aiState,
            base64
          );
          setHistory((prev) => [...prev, resp]);

          speakResponse(
            "Analyse terminée. J'ai détecté des points d'attention sur votre installation."
          );
        } catch (err) {
          logger.error('[MissionMentor] Vision analysis failed', err);
          setHistory((prev) => [
            ...prev,
            {
              message:
                "L'analyse visuelle n'a pas abouti. Vérifiez la connexion ou réessayez avec une autre image.",
              type: 'error',
            } as AIResponse,
          ]);
        } finally {
          setIsThinking(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(
        "La reconnaissance vocale n'est pas supportée sur ce navigateur. Veuillez utiliser Chrome ou Edge."
      );
      return;
    }

    if (isListening) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR'; // Langue optimisée
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    recognition.onerror = (event: any) => {
      logger.warn('[MissionMentor] Speech recognition error', event);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <>
      {/* FLOATING BUTTON (GEM-MINT) */}
      <div
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-10 sm:right-10 z-[1000] no-print"
        title="Ouvrir le Mentor GEM-MINT"
      >
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          title="Assistant GEM-MINT"
          aria-label="Assistant GEM-MINT"
          className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-900/90 hover:bg-blue-500 rounded-2xl sm:rounded-3xl shadow-2xl shadow-blue-600/25 flex items-center justify-center border border-white/10 group relative overflow-hidden backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent animate-pulse" />
          <Bot
            size={20}
            className="text-white group-hover:scale-110 transition-transform sm:size-7"
          />
          {!isOpen && history.length === 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
            </span>
          )}
        </motion.button>
      </div>

      {/* AI PANEL (SAGE GEM-MINT) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className={`fixed left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:left-auto sm:right-10 sm:bottom-32 ${isMaximized ? 'sm:w-[800px] sm:h-[80vh] w-auto h-[78vh]' : 'sm:w-[400px] sm:h-[600px] w-auto h-[72vh]'} z-[1000] bg-slate-950/95 backdrop-blur-3xl !p-0 !rounded-[1.75rem] sm:!rounded-[2.5rem] md:!rounded-[3rem] overflow-hidden flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10 no-print transition-all duration-500 ease-out`}
          >
            {/* Header Sage */}
            <div className="bg-slate-900 border-b border-white/5 p-4 sm:p-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-inner shrink-0">
                  <Sparkles className="text-blue-400" size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[10px] sm:text-[11px] font-black tracking-[0.12em] sm:tracking-[0.3em] text-white uppercase italic leading-none truncate">
                    GEM-MINT
                  </h2>
                  <p className="text-[9px] sm:text-[8px] font-black text-blue-500/60 uppercase tracking-[0.06em] sm:tracking-widest mt-1 truncate">
                    Mentor Sage PROQUELEC
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? 'Activer la voix (J.A.R.V.I.S)' : 'Désactiver la voix'}
                  className={`text-slate-500 hover:text-white transition-colors p-2 rounded-full ${!isMuted ? 'bg-blue-500/10 text-blue-400' : ''}`}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Réduire la fenêtre' : 'Agrandir la fenêtre'}
                  className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                {canManageAI && (
                  <>
                    <button
                      onClick={() => setIsTrainingStudioOpen(true)}
                      title="Studio d'apprentissage"
                      className="text-slate-500 hover:text-emerald-300 transition-colors p-2 rounded-full hover:bg-emerald-500/10"
                    >
                      <BookOpen size={16} />
                    </button>
                    <button
                      onClick={() => setIsAdminPanelOpen(true)}
                      title="Configuration Moteur IA"
                      className="text-slate-500 hover:text-blue-400 transition-colors p-2 rounded-full hover:bg-blue-500/10"
                    >
                      <Bot size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  title="Fermer le Mentor"
                  aria-label="Fermer le Mentor"
                  className="text-slate-500 hover:text-white transition-colors p-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conversation Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar bg-slate-950/20"
            >
              {history.length === 0 && (
                <div className="text-center py-12 sm:py-20 opacity-30 italic px-4 sm:px-10">
                  <Bot size={48} className="mx-auto mb-6 text-blue-600" />
                  <p className="text-xs font-black uppercase tracking-widest leading-loose">
                    "Posez-moi une question sur vos missions, le terrain ou l'audit, et je vous
                    guiderai vers l'excellence."
                  </p>
                </div>
              )}

              {history.map((resp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: resp.type === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 sm:p-5 rounded-[1.4rem] sm:rounded-[2rem] border relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                    resp.type === 'user'
                      ? `bg-slate-800 border-slate-700 text-slate-200 ${isMaximized ? 'ml-auto mr-0 sm:mr-4 max-w-[92%] sm:max-w-[85%]' : 'ml-0 sm:ml-12'} rounded-tr-none shadow-md`
                      : resp.type === 'warning'
                        ? `bg-amber-950 border-amber-500/30 text-amber-100 ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
                        : resp.type === 'error'
                          ? `bg-rose-950 border-rose-500/30 text-rose-100 ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
                          : `bg-[#0a192e] border-blue-500/30 text-blue-50 shadow-xl ${isMaximized ? 'mr-auto ml-0 sm:ml-4 max-w-[92%] sm:max-w-[85%]' : 'mr-0 sm:mr-12'} rounded-tl-none`
                  } ${resp.type !== 'user' ? severityAccentClass(resp.severity) : ''}`}
                >
                  {resp.type !== 'user' && (resp.verdict || resp.severity) && (
                    <div
                      className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${verdictAccentClass(resp.verdict)}`}
                    />
                  )}
                  <div className="flex gap-4 items-start">
                    {resp.type !== 'user' && (
                      <div
                        className={`p-2 rounded-xl border ${
                          resp.type === 'warning'
                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                            : resp.type === 'error'
                              ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                              : 'bg-blue-600/20 border-blue-600/30 text-blue-400'
                        }`}
                      >
                        {resp.type === 'warning' ? (
                          <ShieldAlert size={16} />
                        ) : resp.type === 'error' ? (
                          <X size={16} />
                        ) : (
                          <Info size={16} />
                        )}
                      </div>
                    )}
                    <div className="flex-1 space-y-4">
                      {(resp.verdict || resp.severity) && (
                        <div className="flex flex-wrap gap-2">
                          {resp.verdict && (
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${verdictBadgeClass(resp.verdict)}`}
                            >
                              {(() => {
                                const Icon = VerdictIcon(resp.verdict);
                                return <Icon size={12} className="mr-1.5" />;
                              })()}
                              {resp.verdict}
                            </span>
                          )}
                          {resp.severity && (
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${severityBadgeClass(resp.severity)}`}
                            >
                              {(() => {
                                const Icon = SeverityIcon(resp.severity);
                                return <Icon size={12} className="mr-1.5" />;
                              })()}
                              {resp.severity}
                            </span>
                          )}
                        </div>
                      )}
                      {resp.type === 'user' ? (
                        <p className="text-[13px] font-bold leading-7 whitespace-pre-wrap italic text-slate-100">
                          {resp.message}
                        </p>
                      ) : (
                        <AIPremiumMessage message={resp.message} />
                      )}

                      {resp.controlSheet && controlSheetEntries(resp.controlSheet).length > 0 && (
                        <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                              Fiche de controle terrain
                            </p>
                            {resp._engine === 'VISION' && (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                                Vision assistee
                              </span>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {controlSheetEntries(resp.controlSheet).map((entry) => (
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

                      {resp.recommendedAction &&
                        resp.recommendedAction !== resp.controlSheet?.immediateAction && (
                          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                              Action recommandee
                            </p>
                            <p className="mt-2 text-[12px] font-semibold leading-relaxed text-cyan-50">
                              {resp.recommendedAction}
                            </p>
                          </div>
                        )}

                      {resp.images && resp.images.length > 0 && (
                        <div className="grid gap-4 mt-2">
                          {resp.images.map((img, idx) => (
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

                  {resp.actionLabel && (
                    <div className="mt-4 flex gap-3">
                      {resp.actionType === 'download_report' ? (
                        <button
                          onClick={async () => {
                            const insights = analyzeDG(stats, households, auditLogs);
                            await wordReportService.generateStrategicReport(
                              stats,
                              insights,
                              households
                            );
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg shadow-blue-600/20 transition-all text-white"
                        >
                          {resp.actionLabel}
                          <Send size={10} className="text-white" />
                        </button>
                      ) : (
                        <a
                          href={resp.actionPath}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/5 transition-all text-blue-400"
                        >
                          {resp.actionLabel}
                          <Sparkles size={10} className="text-blue-400" />
                        </a>
                      )}
                    </div>
                  )}

                  {resp.smartReplies && resp.smartReplies.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resp.smartReplies.map((sr: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setQuery(sr);
                            // Auto-submit via ref event dispatch isn't needed, we can just call it asynchronously!
                            setTimeout(() => {
                              const btn = document.getElementById('ai-send-btn');
                              if (btn) btn.click();
                            }, 50);
                          }}
                          className="px-3 py-1.5 bg-white/5 hover:bg-blue-500/20 text-blue-300 text-[10px] font-bold tracking-wide rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors"
                        >
                          {sr}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {isThinking && (
                <div className="flex gap-2 p-5 bg-blue-600/5 border border-white/5 rounded-3xl w-24">
                  <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-75" />
                  <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-150" />
                  <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-300" />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-6 bg-slate-900 border-t border-white/5">
              <div className="relative group">
                <input
                  id="ai-camera-upload"
                  type="file"
                  accept="image/*"
                  capture="environment" /* Workaround: browser support varies */
                  className="hidden"
                  ref={fileInputRef}
                  title="Capturer une photo pour analyse IA"
                  aria-label="Charger une image ou prendre une photo"
                  onChange={handleCameraUpload}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez votre question avec respect..."
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-4 sm:pl-6 pr-[6.5rem] py-3.5 sm:py-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all shadow-inner placeholder-slate-600"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Capturer une Anomalie (Caméra)"
                  aria-label="Capturer une Anomalie"
                  className="absolute right-[3.5rem] top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                >
                  <Camera size={18} />
                </button>
                <button
                  onClick={toggleListening}
                  disabled={isThinking}
                  title="Dicter au Mentor (Microphone)"
                  aria-label="Dictée Vocale"
                  className={`absolute right-[6rem] top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'}`}
                >
                  <Mic size={18} />
                </button>
                <button
                  id="ai-send-btn"
                  onClick={handleSend}
                  disabled={!query.trim() || isThinking}
                  title="Envoyer le message"
                  aria-label="Envoyer le message"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:scale-90 active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-center text-[9px] sm:text-[8px] font-black text-slate-700 uppercase tracking-[0.06em] sm:tracking-widest mt-4 flex items-center justify-center gap-2">
                <Heart size={10} /> Powered by GEM-SAGE Intelligence 8.0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI ENGINE CONFIG MODAL */}
      {isAdminPanelOpen && user && (
        <AIEngineAdminPanel user={user} onClose={() => setIsAdminPanelOpen(false)} />
      )}
      {isTrainingStudioOpen && user && (
        <AITrainingStudio
          user={user}
          stats={stats}
          auditLogs={auditLogs}
          households={households}
          teams={teams}
          regionalSummaries={regionalSummaries}
          onClose={() => setIsTrainingStudioOpen(false)}
        />
      )}
    </>
  );
};

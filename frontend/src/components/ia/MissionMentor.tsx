import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  Sparkles,
  X,
  Info,
  ShieldAlert,
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
import type { AIResponse } from '../../services/ai/MissionSageService';
import { missionSageService } from '../../services/ai/MissionSageService';
import { wordReportService } from '../../services/ai/WordReportService';
import { analyzeDG } from '../../services/ai/DecisionEngine';
import type { MissionStats } from '../../services/missionStatsService';
import type { AuditLog, Household } from '../../utils/types';
import AIEngineAdminPanel from './AIEngineAdminPanel';

interface MissionMentorProps {
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
}

/**
 * COMPOSANT : MissionMentor (GEM-MINT) 🛡️🕌🤖
 * Le Guide Intelligent de la plateforme PROQUELEC.
 * Sagesse, Respect, Sécurité et Direction Sécure.
 */
export const MissionMentor: React.FC<MissionMentorProps> = ({ stats, auditLogs, households }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          const msg = await missionSageService.getProactiveMessage(user, {
            stats,
            auditLogs,
            households,
          });
          if (msg) setHistory([msg]);
        } catch (err) {
          console.error('Proactive message failed', err);
        } finally {
          setIsThinking(false);
        }
      };
      checkProactive();
    }
  }, [isOpen, user, stats, auditLogs, households]);

  const handleSend = async () => {
    if (!query.trim() || !user) return;

    setIsThinking(true);
    const originalQuery = query;
    setQuery('');

    // Afficher directement le message de l'utilisateur
    setHistory((prev) => [...prev, { message: originalQuery, type: 'user' } as AIResponse]);

    // Simulation de réflexion de l'IA (Sagesse de Guide)
    setTimeout(async () => {
      try {
        const resp = await missionSageService.processQuery(originalQuery, user, {
          stats,
          auditLogs,
          households,
        });

        // J.A.R.V.I.S : Génération dynamique de Smart Replies contextuelles
        if (!resp.smartReplies) {
          if (
            resp.message.toLowerCase().includes('tech') ||
            resp.message.toLowerCase().includes('norme')
          ) {
            resp.smartReplies = [
              'Voir les Anomalies MFR',
              'Comment dénuder un câble ?',
              'Aide Vision AI',
            ];
          } else if (resp.message.toLowerCase().includes('mission')) {
            resp.smartReplies = ['Aide Création OM', 'Comment certifier ?', 'QR Code Validation'];
          } else {
            resp.smartReplies = ['Aide Vision AI', 'Aide Rapports Word', 'Pilotage IGPP'];
          }
        }

        setHistory((prev) => [...prev, resp]);

        // TEXT-TO-SPEECH (J.A.R.V.I.S Mode)
        if (!isMuted && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          // Strip emojis and markdown for pure voice
          const pureText = resp.message.replace(
            /[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]|\*/gu,
            ''
          );
          const utterance = new SpeechSynthesisUtterance(pureText);
          utterance.lang = 'fr-FR';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        }
      } catch (err: any) {
        console.error('MissionMentor: Error processing query', err);
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
    }, 1200);
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
            { stats, auditLogs, households },
            base64
          );
          setHistory((prev) => [...prev, resp]);

          if (!isMuted && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              "Analyse terminée. J'ai détecté des points d'attention sur votre installation."
            );
            utterance.lang = 'fr-FR';
            window.speechSynthesis.speak(utterance);
          }
        } catch (err) {
          console.error('Vision Analysis failed', err);
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
      console.error('Speech Recognition Error', event);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <>
      <style>
        {`
          .ai-message-anchor::first-line {
            font-size: 14px;
            font-weight: 900;
            color: #60a5fa;
            border-left: 3px solid #3b82f6;
            padding-left: 8px;
            margin-bottom: 4px;
            display: block;
          }
          .ai-response-first-line-visible {
            padding-top: 8px;
          }
        `}
      </style>
      {/* FLOATING BUTTON (GEM-MINT) */}
      <div className="fixed bottom-10 right-10 z-[1000] no-print" title="Ouvrir le Mentor GEM-MINT">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          title="Assistant GEM-MINT"
          aria-label="Assistant GEM-MINT"
          className="w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-3xl shadow-2xl shadow-blue-600/40 flex items-center justify-center border border-white/20 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent animate-pulse" />
          <Bot size={28} className="text-white group-hover:scale-110 transition-transform" />
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
            className={`fixed bottom-32 right-10 ${isMaximized ? 'w-[calc(100vw-80px)] md:w-[800px] h-[80vh]' : 'w-[400px] h-[600px]'} z-[1000] bg-slate-950/95 backdrop-blur-3xl !p-0 !rounded-[2.5rem] md:!rounded-[3rem] overflow-hidden flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10 no-print transition-all duration-500 ease-out`}
          >
            {/* Header Sage */}
            <div className="bg-slate-900 border-b border-white/5 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
                  <Sparkles className="text-blue-400" size={20} />
                </div>
                <div>
                  <h2 className="text-[11px] font-black tracking-[0.3em] text-white uppercase italic leading-none">
                    GEM-MINT
                  </h2>
                  <p className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest mt-1">
                    Mentor Sage PROQUELEC
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                {(user?.role === 'ADMIN_PROQUELEC' || user?.email === 'admingem') && (
                  <button
                    onClick={() => setIsAdminPanelOpen(true)}
                    title="Configuration Moteur IA"
                    className="text-slate-500 hover:text-blue-400 transition-colors p-2 rounded-full hover:bg-blue-500/10"
                  >
                    <Bot size={16} />
                  </button>
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
              className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/20"
            >
              {history.length === 0 && (
                <div className="text-center py-20 opacity-30 italic px-10">
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
                  className={`p-5 rounded-[2rem] border relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                    resp.type === 'user'
                      ? `bg-slate-800 border-slate-700 text-slate-200 ${isMaximized ? 'ml-auto mr-4 max-w-[85%]' : 'ml-12'} rounded-tr-none shadow-md`
                      : resp.type === 'warning'
                        ? `bg-amber-950 border-amber-500/30 text-amber-100 ${isMaximized ? 'mr-auto ml-4 max-w-[85%]' : 'mr-12'} rounded-tl-none`
                        : resp.type === 'error'
                          ? `bg-rose-950 border-rose-500/30 text-rose-100 ${isMaximized ? 'mr-auto ml-4 max-w-[85%]' : 'mr-12'} rounded-tl-none`
                          : `bg-[#0a192e] border-blue-500/30 text-blue-50 shadow-xl ${isMaximized ? 'mr-auto ml-4 max-w-[85%]' : 'mr-12'} rounded-tl-none ai-message-anchor`
                  }`}
                >
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
                      <p
                        className={`text-[13px] font-bold leading-relaxed whitespace-pre-wrap ${resp.type === 'user' ? 'italic' : 'ai-response-first-line-visible'}`}
                      >
                        {resp.message}
                      </p>

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
            <div className="p-6 bg-slate-900 border-t border-white/5">
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
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-6 pr-[6.5rem] py-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all shadow-inner placeholder-slate-600"
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
              <p className="text-center text-[8px] font-black text-slate-700 uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
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
    </>
  );
};

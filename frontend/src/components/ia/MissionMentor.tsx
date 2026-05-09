/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  X,
  BookOpen,
  Heart,
  Send,
  Camera,
  Mic,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Search,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
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
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import ChatInterface from './MissionMentor/ChatInterface';
import InputBar from './MissionMentor/InputBar';
import VoiceControls from './MissionMentor/VoiceControls';

interface MissionMentorProps {
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
  teams: Team[];
  regionalSummaries: RegionalSummary[];
}

interface User {
  role: string;
  email: string;
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
  const typedUser: User | null = user ? {
    role: user.role || 'USER',
    email: user.email || '',
  } : null;
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
  const canManageAI = hasPermission(user, PERMISSIONS.CONFIGURER_MOTEUR_IA);

  const speakResponse = (message: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const pureText = message.replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]|\*/gu, '');
    const utterance = new SpeechSynthesisUtterance(pureText);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  // EFFET PROACTIF (S'active à l'ouverture si pas d'historique)
  useEffect(() => {
    if (isOpen && history.length === 0 && typedUser && (stats || auditLogs.length > 0)) {
      const checkProactive = async () => {
        setIsThinking(true);
        try {
          const msg = await missionSageService.getProactiveMessage(typedUser, aiState);
          if (msg) setHistory([msg]);
        } catch (err) {
          logger.warn('[MissionMentor] Proactive message unavailable', err);
        } finally {
          setIsThinking(false);
        }
      };
      checkProactive();
    }
  }, [aiState, auditLogs.length, history.length, isOpen, stats, typedUser]);

  const handleSend = async () => {
    if (!query.trim() || !typedUser) return;

    setIsThinking(true);
    const originalQuery = query;
    setQuery('');

    // Afficher directement le message de l'utilisateur
    setHistory((prev) => [...prev, { message: originalQuery, type: 'user' } as AIResponse]);

    try {
      const resp = await missionSageService.processQuery(originalQuery, typedUser, aiState);
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
            typedUser!,
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
 
  const handleActionExecute = async (suggestion: any) => {
    const tid = toast.loading(`Exécution : ${suggestion.label}...`);
    try {
      const response = await apiClient.post('ai/agent/execute', {
        action: suggestion.action
      });
      
      if (response.data.success) {
        toast.success(response.data.message, { id: tid });
        setHistory(prev => [...prev, { 
          message: `✅ ${response.data.message}`, 
          type: 'success',
          _engine: 'RULES'
        } as AIResponse]);
      } else {
        toast.error(response.data.message || "Échec de l'exécution", { id: tid });
      }
    } catch (error) {
      toast.error("Erreur lors de l'exécution de l'action", { id: tid });
      logger.error('[MissionMentor] Action execution failed', error);
    }
  };

  return (
    <>
      {/* FLOATING BUTTON (GEM-MINT) */}
      <div
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-10 sm:right-10 z-[1000] no-print"
        title="Ouvrir GAM AI"
      >
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          title="Assistant GAM AI"
          aria-label="Assistant GAM AI"
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
                    GAM AI
                  </h2>
                  <p className="text-[9px] sm:text-[8px] font-black text-blue-500/60 uppercase tracking-[0.06em] sm:tracking-widest mt-1 truncate">
                    Assistant Expert Souverain
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <VoiceControls
                  isMuted={isMuted}
                  isMaximized={isMaximized}
                  onToggleMute={() => setIsMuted(!isMuted)}
                  onToggleMaximize={() => setIsMaximized(!isMaximized)}
                  canManageAI={canManageAI}
                />
                {canManageAI && (
                  <>
                    <button
                      onClick={() => setIsTrainingStudioOpen(true)}
                      title="📚 Studio d'apprentissage & Référentiel"
                      className="group flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                    >
                      <BookOpen size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      onClick={() => setIsAdminPanelOpen(true)}
                      title="⚙️ Configuration Moteur IA Privée"
                      className="group relative flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-900/20"
                    >
                      <Bot size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse border border-slate-900"></span>
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
            <ChatInterface
              history={history}
              isThinking={isThinking}
              isMaximized={isMaximized}
              onSmartReply={(reply) => {
                setQuery(reply);
                void handleSend();
              }}
              onActionExecute={handleActionExecute}
            />

            {/* Input Area */}
            <InputBar
              query={query}
              onQueryChange={setQuery}
              onSend={handleSend}
              onCameraClick={() => fileInputRef.current?.click()}
              onMicClick={toggleListening}
              isListening={isListening}
              isThinking={isThinking}
              fileInputRef={fileInputRef}
            />
            <p className="text-center text-[9px] sm:text-[8px] font-black text-slate-700 uppercase tracking-[0.06em] sm:tracking-widest mt-4 flex items-center justify-center gap-2">
              <Heart size={10} /> Powered by GEM-SAGE Intelligence 8.0
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI ENGINE CONFIG MODAL */}
      {isAdminPanelOpen && typedUser && (
        <AIEngineAdminPanel user={typedUser} onClose={() => setIsAdminPanelOpen(false)} />
      )}
      {isTrainingStudioOpen && typedUser && (
        <AITrainingStudio
          user={typedUser}
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

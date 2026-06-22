/**
 * 🤖 GedOsAiChat - Composant de chat IA intégré avec GedOsAiCore
 * Version améliorée de MissionMentor utilisant le cerveau IA centralisé
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot, CircleCheck, CircleDashed } from 'lucide-react';
import { useGedOsAiChat } from '@hooks/useGedOsAiCore';
import type { AIState } from '@services/ai/MissionSageService';
import type { MissionStats } from '@services/missionStatsService';
import ChatInterface from './ChatInterface';
import InputBar from './InputBar';
import VoiceControls from './VoiceControls';
import type { AuditLog, Household, Team } from '@utils/types';
import logger from '@utils/logger';
import apiClient from '@/api/client';

interface GedOsAiChatProps {
  stats?: MissionStats | null;
  auditLogs?: AuditLog[];
  households?: Household[];
  teams?: Team[];
  regionalSummaries?: any[];
  canManageAI?: boolean;
  className?: string;
}

export default function GedOsAiChat({
  stats,
  auditLogs = [],
  households = [],
  teams = [],
  regionalSummaries = [],
  canManageAI = false,
  className = "bottom-32 right-4",
}: GedOsAiChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Construire le contexte AI
  const aiContext: AIState = {
    stats: stats || null,
    auditLogs,
    households,
    teams,
    regionalSummaries,
  };

  // Utiliser le hook GedOsAiCore pour le chat
  const { sendMessage, sendFeedback, isThinking, lastResponse } = useGedOsAiChat(aiContext);

  const handleSend = async (forcedQuery?: string) => {
    const nextQuery = (forcedQuery ?? query).trim();
    if (!nextQuery || isThinking) return;

    const userMessage = nextQuery;
    setQuery('');
    setHistory((prev) => [...prev, { message: userMessage, type: 'user' }]);

    try {
      const response = await sendMessage(userMessage, {
        enableEnrichment: true,
        enableTraining: true,
      });

      setHistory((prev) => [...prev, response.response]);
    } catch (err) {
      logger.error('[GedOsAiChat] Failed to send message', err);
      setHistory((prev) => [
        ...prev,
        {
          message: 'Désolé, une erreur est survenue. Veuillez réessayer.',
          type: 'error',
        },
      ]);
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Note: La reconnaissance vocale nécessite l'API Web Speech
    // Pour l'implémentation complète, utiliser:
    // - window.SpeechRecognition ou window.webkitSpeechRecognition
    // - Gérer les événements onresult, onerror, onend
    // - Ajouter le support pour les langues (fr-FR)
    if (!isListening) {
      // Placeholder pour l'implémentation future
      logger.info('Reconnaissance vocale activée (à implémenter)');
    }
  };

  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.info('Camera upload:', file.name);
    setHistory((prev) => [...prev, { message: `Photo transmise : ${file.name}`, type: 'user' }]);

    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Lecture image impossible'));
        reader.readAsDataURL(file);
      });

      const { data } = await apiClient.post('/ai/mentor/query', {
        message: "Analyse cette photo terrain GED OS. Donne le verdict, les risques et l'action corrective.",
        context: aiContext,
        history: history
          .slice(-6)
          .map((entry) => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message || '',
          })),
        image,
      });

      setHistory((prev) => [
        ...prev,
        {
          message: data?.message || "Analyse visuelle indisponible.",
          type: data?.type || 'warning',
          _engine: data?._engine || 'VISION',
        },
      ]);
    } catch (err) {
      logger.error('[GedOsAiChat] Vision analysis failed', err);
      setHistory((prev) => [
        ...prev,
        {
          message:
            "Analyse visuelle indisponible. Décrivez l'anomalie visible et je lancerai l'analyse texte GED OS.",
          type: 'error',
          _engine: 'VISION_ERROR',
        },
      ]);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className={`fixed z-50 ${className} ${isMaximized ? 'inset-4 bottom-4 right-4' : ''}`}>
      {/* Bouton flottant pour ouvrir/fermer */}
      {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/40 flex items-center justify-center text-white border-2 border-white/20 relative group"
            aria-label="Ouvrir GAM AI"
          >
            <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
            <Bot size={32} className="relative z-10" />
          </motion.button>
      )}

      {/* Panneau de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden ${
              isMaximized ? 'w-full h-full' : 'w-[400px] h-[600px]'
            }`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 border border-white/20">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white italic tracking-tighter flex items-center gap-2">
                      GAM <span className="text-blue-400">AI</span>
                    </h3>
                    <p className="text-[9px] text-blue-300 font-black uppercase tracking-[0.2em] opacity-80">
                      Assistant GED OS
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300/80">
                      {isThinking ? <CircleDashed size={10} className="animate-spin" /> : <CircleCheck size={10} />}
                      {isThinking ? 'Analyse en cours' : 'Agent local prêt'}
                    </div>
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
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Fermer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Zone de conversation */}
            <ChatInterface
              history={history}
              isThinking={isThinking}
              isMaximized={isMaximized}
              onSmartReply={(reply) => {
                void handleSend(reply);
              }}
            />

            {/* Zone de saisie */}
            <InputBar
              query={query}
              onQueryChange={setQuery}
              onSend={handleSend}
              onCameraClick={() => fileInputRef.current?.click()}
              onFileChange={handleCameraUpload}
              onMicClick={toggleListening}
              isListening={isListening}
              isThinking={isThinking}
              fileInputRef={fileInputRef}
            />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

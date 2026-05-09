/**
 * 🤖 GEMAIChat - Composant de chat IA intégré avec GEMAICore
 * Version améliorée de MissionMentor utilisant le cerveau IA centralisé
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGEMAIChat } from '../../../hooks/useGEMAICore';
import type { AIState } from '../../../services/ai/MissionSageService';
import type { MissionStats } from '../../../services/missionStatsService';
import ChatInterface from './ChatInterface';
import InputBar from './InputBar';
import VoiceControls from './VoiceControls';
import type { AuditLog, Household, Team } from '../../../utils/types';

interface GEMAIChatProps {
  stats?: MissionStats | null;
  auditLogs?: AuditLog[];
  households?: Household[];
  teams?: Team[];
  regionalSummaries?: any[];
  canManageAI?: boolean;
}

export default function GEMAIChat({
  stats,
  auditLogs = [],
  households = [],
  teams = [],
  regionalSummaries = [],
  canManageAI = false,
}: GEMAIChatProps) {
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

  // Utiliser le hook GEMAICore pour le chat
  const { sendMessage, sendFeedback, isThinking, lastResponse } = useGEMAIChat(aiContext);

  const handleSend = async () => {
    if (!query.trim() || isThinking) return;

    const userMessage = query;
    setQuery('');
    setHistory((prev) => [...prev, { message: userMessage, type: 'user' }]);

    try {
      const response = await sendMessage(userMessage, {
        enableEnrichment: true,
        enableTraining: true,
      });

      setHistory((prev) => [...prev, response.response]);
    } catch (err) {
      console.error('[GEMAIChat] Failed to send message', err);
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
    // TODO: Implémenter la reconnaissance vocale
  };

  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Implémenter l'upload d'image et l'analyse vision
    console.log('Camera upload:', file);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${isMaximized ? 'inset-4 bottom-4 right-4' : ''}`}>
      {/* Bouton flottant pour ouvrir/fermer */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-600/30 flex items-center justify-center text-white border-2 border-white/20"
          aria-label="Ouvrir le mentor IA"
        >
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Mission Mentor AI
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Cerveau centralisé GEM
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
                setQuery(reply);
                void handleSend();
              }}
            />

            {/* Zone de saisie */}
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

            {/* Input file caché */}
            <input
              id="ai-camera-upload"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCameraUpload}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

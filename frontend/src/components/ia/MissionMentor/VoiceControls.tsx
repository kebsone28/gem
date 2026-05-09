/**
 * 🎙️ VoiceControls - Composant de contrôles vocaux pour le mentor IA
 * Boutons pour activer/désactiver la voix synthétisée et la reconnaissance vocale
 */

import React from 'react';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';

interface VoiceControlsProps {
  isMuted: boolean;
  isMaximized: boolean;
  onToggleMute: () => void;
  onToggleMaximize: () => void;
  canManageAI?: boolean;
}

export default function VoiceControls({
  isMuted,
  isMaximized,
  onToggleMute,
  onToggleMaximize,
  canManageAI = false,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Activer la voix (J.A.R.V.I.S)' : 'Désactiver la voix'}
        aria-label={isMuted ? "Activer la voix du mentor" : "Désactiver la voix du mentor"}
        className={`text-slate-500 hover:text-white transition-colors p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${!isMuted ? 'bg-blue-500/10 text-blue-400' : ''}`}
        tabIndex={0}
      >
        {isMuted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      </button>
      <button
        onClick={onToggleMaximize}
        title={isMaximized ? 'Réduire la fenêtre' : 'Agrandir la fenêtre'}
        aria-label={isMaximized ? "Réduire la fenêtre de chat" : "Agrandir la fenêtre de chat"}
        className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        tabIndex={0}
      >
        {isMaximized ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

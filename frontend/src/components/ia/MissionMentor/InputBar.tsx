/**
 * 📝 InputBar - Composant de barre de saisie pour le chat IA
 * Zone d'input avec boutons microphone, caméra et envoi
 */

import React from 'react';
import { Camera, Mic, Send } from 'lucide-react';

interface InputBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  onCameraClick: () => void;
  onMicClick: () => void;
  isListening?: boolean;
  isThinking?: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function InputBar({
  query,
  onQueryChange,
  onSend,
  onCameraClick,
  onMicClick,
  isListening = false,
  isThinking = false,
  fileInputRef,
}: InputBarProps) {
  return (
    <div className="p-4 sm:p-6 bg-slate-900 border-t border-white/5">
      <div className="relative group">
        <input
          id="ai-camera-upload"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          title="Capturer une photo pour analyse IA"
          aria-label="Charger une image ou prendre une photo"
          onChange={(e) => {
            // Handle file upload
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Posez votre question avec respect..."
          aria-label="Champ de saisie de question pour le mentor IA"
          className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-4 sm:pl-6 pr-[6.5rem] py-3.5 sm:py-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner placeholder-slate-600"
        />
        <button
          onClick={onCameraClick}
          title="Capturer une Anomalie (Caméra)"
          aria-label="Capturer une Anomalie avec la caméra"
          className="absolute right-[3.5rem] top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          tabIndex={0}
        >
          <Camera size={18} aria-hidden="true" />
        </button>
        <button
          onClick={onMicClick}
          disabled={isThinking}
          title="Dicter au Mentor (Microphone)"
          aria-label={isListening ? "Arrêter l'écoute vocale" : "Activer la dictée vocale"}
          className={`absolute right-[6rem] top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'}`}
          tabIndex={0}
        >
          <Mic size={18} aria-hidden="true" />
        </button>
        <button
          onClick={onSend}
          disabled={!query.trim() || isThinking}
          title="Envoyer le message"
          aria-label="Envoyer le message"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:scale-90 active:scale-95 shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          tabIndex={0}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

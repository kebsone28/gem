/**
 * 💬 ChatInterface - Composant d'interface de chat pour le mentor IA
 * Zone de conversation avec historique des messages
 */

import React, { useRef, useEffect, useMemo } from 'react';
import type { AIResponse } from '../../../services/ai/MissionSageService';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  history: AIResponse[];
  isThinking: boolean;
  isMaximized: boolean;
  onSmartReply: (reply: string) => void;
  onActionExecute?: (suggestion: any) => void;
}

export default function ChatInterface({
  history,
  isThinking,
  isMaximized,
  onSmartReply,
  onActionExecute,
}: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoize le message vide pour éviter les re-renders
  const emptyState = useMemo(() => (
    <div className="text-center py-12 sm:py-20 opacity-30 italic px-4 sm:px-10">
      <p className="text-xs font-black uppercase tracking-widest leading-loose">
        "Posez-moi une question sur vos missions, le terrain ou l'audit, et je vous
        guiderai vers l'excellence."
      </p>
    </div>
  ), []);

  // Memoize l'état de chargement
  const thinkingState = useMemo(() => (
    <div className="flex gap-2 p-5 bg-blue-600/5 border border-white/5 rounded-3xl w-24">
      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-75" />
      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-150" />
      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce delay-300" />
    </div>
  ), []);

  // Auto-scroll à chaque nouveau message
  useEffect(() => {
    if (scrollRef.current && history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (lastMessage.type !== 'user') {
        setTimeout(() => {
          if (scrollRef.current) {
            const container = scrollRef.current;
            const lastMessageElement = container.lastElementChild as HTMLElement;
            if (lastMessageElement) {
              const containerRect = container.getBoundingClientRect();
              const messageRect = lastMessageElement.getBoundingClientRect();
              const scrollTop = container.scrollTop + (messageRect.top - containerRect.top) - 40;
              container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
            }
          }
        }, 200);
      } else {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }
        }, 100);
      }
    }
  }, [history]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar bg-slate-950/20"
      role="log"
      aria-live="polite"
      aria-label="Historique de conversation avec le mentor IA"
    >
      {history.length === 0 && emptyState}

      {history.map((resp, i) => (
        <MessageBubble
          key={i}
          response={resp}
          isMaximized={isMaximized}
          onActionExecute={onActionExecute}
        />
      ))}

      {isThinking && thinkingState}
    </div>
  );
}

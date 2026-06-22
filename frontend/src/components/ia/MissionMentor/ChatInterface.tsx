/**
 * 💬 ChatInterface - Composant d'interface de chat pour le mentor IA
 * Zone de conversation avec historique des messages
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { Bot, ClipboardCheck, Map, ShieldCheck, Wrench } from 'lucide-react';
import type { AIResponse } from '@services/ai/MissionSageService';
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
  const emptyState = useMemo(() => {
    const quickPrompts = [
      { icon: ClipboardCheck, label: 'Résumé missions', prompt: 'Fais un résumé opérationnel des missions en cours et des blocages.' },
      { icon: Map, label: 'Audit terrain', prompt: 'Analyse les risques terrain visibles et propose les priorités de contrôle.' },
      { icon: ShieldCheck, label: 'Conformité', prompt: 'Quels points de conformité électrique dois-je vérifier en priorité ?' },
      { icon: Wrench, label: 'Plan action', prompt: 'Donne-moi un plan d’action court pour améliorer GED OS aujourd’hui.' },
    ];

    return (
      <div className="py-8 sm:py-10 px-2 sm:px-4">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <Bot size={26} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-200">
            Agent GED OS prêt
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
            Connecté au contexte serveur, aux règles métier et au moteur IA local selon la configuration admin.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2">
          {quickPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSmartReply(item.prompt)}
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-blue-400/30 hover:bg-blue-500/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-blue-300">
                <item.icon size={17} />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }, [onSmartReply]);

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

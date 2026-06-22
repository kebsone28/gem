/**
 * Hybrid Chatbot Widget Component
 * Floating bubble (bottom-right) with intelligent routing
 * Routes queries to Ollama (private data) or Puter.js (public questions)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useHybridChatbot } from '@hooks/useHybridChatbot';

export const HybridChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const { messages, loading, sendMessage } = useHybridChatbot();
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique vers le bas lors de l'arrivée d'un message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans">
      {/* 1. BULLE FLOTTANTE (Bouton d'ouverture) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-[58px] h-[58px] rounded-full bg-blue-600 text-white border-none cursor-pointer shadow-lg text-2xl flex items-center justify-center transition-transform duration-200 hover:scale-105"
          title="Ouvrir l'assistant GED OS"
        >
          🤖
        </button>
      )}

      {/* 2. PANNEAU DE CHAT EXTENSIBLE */}
      {isOpen && (
        <div className="w-[340px] h-[450px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <div>
              <div className="font-bold text-sm">
                GED OS AI Assistant
              </div>
              <div className="text-[11px] text-slate-400">
                Hybride (Local/Cloud)
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="bg-transparent border-none text-slate-400 cursor-pointer text-lg hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          {/* Zone d'historique des messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="text-slate-500 text-[13px] text-center mt-10 px-2.5">
                Posez une question générale (Gratuit via Cloud) ou une question
                sur vos données métiers (Sécurisé via Ollama).
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}
              >
                {/* Badge indicateur de route (Uniquement pour l'assistant) */}
                {msg.sender === 'assistant' && msg.route !== 'system' && (
                  <span className="text-[9px] text-slate-500 ml-1 block mb-0.5">
                    {msg.route}
                  </span>
                )}

                {/* Corps du message */}
                <div
                  className={`px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white shadow-none border-none'
                      : msg.route === 'system'
                        ? 'bg-red-100 text-red-800 shadow-sm border border-slate-200'
                        : 'bg-white text-slate-700 shadow-sm border border-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Spinner de chargement */}
            {loading && (
              <div className="self-start px-3.5 py-2.5 bg-slate-200 rounded-lg text-xs text-slate-600">
                Analyse et génération en cours...
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          {/* Formulaire de saisie */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-gray-200 flex gap-2 bg-white"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez votre question ici..."
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-md border border-slate-300 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="px-3.5 py-2 text-white border-none rounded-md cursor-pointer text-[13px] font-bold disabled:bg-slate-400 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

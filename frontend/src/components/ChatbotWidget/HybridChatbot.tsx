/**
 * Hybrid Chatbot Widget Component
 * Floating bubble (bottom-right) with intelligent routing
 * Routes queries to Ollama (private data) or Puter.js (public questions)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useHybridChatbot } from '../../hooks/useHybridChatbot';

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
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        fontFamily: 'sans-serif',
      }}
    >
      {/* 1. BULLE FLOTTANTE (Bouton d'ouverture) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '58px',
            height: '58px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          title="Ouvrir l'assistant GED OS"
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🤖
        </button>
      )}

      {/* 2. PANNEAU DE CHAT EXTENSIBLE */}
      {isOpen && (
        <div
          style={{
            width: '340px',
            height: '450px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#1e293b',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                GED OS AI Assistant
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Hybride (Local/Cloud)
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Zone d'historique des messages */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  color: '#64748b',
                  fontSize: '13px',
                  textAlign: 'center',
                  marginTop: '40px',
                  padding: '0 10px',
                }}
              >
                Posez une question générale (Gratuit via Cloud) ou une question
                sur vos données métiers (Sécurisé via Ollama).
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                {/* Badge indicateur de route (Uniquement pour l'assistant) */}
                {msg.sender === 'assistant' && msg.route !== 'system' && (
                  <span
                    style={{
                      fontSize: '9px',
                      color: '#64748b',
                      marginLeft: '4px',
                      display: 'block',
                      marginBottom: '2px',
                    }}
                  >
                    {msg.route}
                  </span>
                )}

                {/* Corps du message */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    backgroundColor:
                      msg.sender === 'user'
                        ? '#2563eb'
                        : msg.route === 'system'
                          ? '#fee2e2'
                          : '#ffffff',
                    color:
                      msg.sender === 'user'
                        ? 'white'
                        : msg.route === 'system'
                          ? '#991b1b'
                          : '#334155',
                    boxShadow:
                      msg.sender === 'user'
                        ? 'none'
                        : '0 1px 3px rgba(0,0,0,0.05)',
                    border:
                      msg.sender === 'user'
                        ? 'none'
                        : '1px solid #e2e8f0',
                    whiteSpace: 'pre-line', // Gère grossièrement les retours à la ligne
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Spinner de chargement */}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                Analyse et génération en cours...
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          {/* Formulaire de saisie */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '12px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '8px',
              backgroundColor: '#ffffff',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez votre question ici..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              style={{
                padding: '8px 14px',
                backgroundColor:
                  loading || !inputValue.trim() ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

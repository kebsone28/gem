/**
 * Custom Hook - Hybrid Chatbot Logic
 * Manages message state, routing, and API calls to Ollama or Puter.js
 */

import { useState, useCallback } from 'react';
import { shouldRouteToOllama } from '../utils/chatbot-router';

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  route: '🆓 Puter' | '🔐 Ollama' | 'system';
  timestamp: Date;
}

export const useHybridChatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // 1. Ajouter le message de l'utilisateur à l'historique
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      content,
      route: shouldRouteToOllama(content) ? '🔐 Ollama' : '🆓 Puter',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let responseText = '';
      const targetRoute = userMessage.route;

      // 2. Branchement de routage intelligent
      if (targetRoute === '🔐 Ollama') {
        // Envoi au backend local de GED OS
        const response = await fetch('/api/ai/agent/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Ajoutez votre token JWT ici si requis par votre middleware d'auth
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ message: content }),
        });

        if (!response.ok) throw new Error('Erreur serveur Ollama');
        const data = await response.json();
        responseText = data.response;
      } else {
        // Envoi direct et décentralisé à Puter.js côté client
        if (window.puter && window.puter.ai) {
          responseText = await window.puter.ai.chat('gpt-5.4-nano', content);
        } else {
          throw new Error("Le SDK Puter.js n'est pas encore chargé dans le navigateur.");
        }
      }

      // 3. Ajouter la réponse de l'assistant
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'assistant',
        content: responseText,
        route: targetRoute,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      // Gestion des erreurs
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'assistant',
        content: `Désolé, une erreur est survenue lors du traitement (${error.message || 'Erreur inconnue'}).`,
        route: 'system',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    loading,
    sendMessage,
    clearHistory,
  };
};

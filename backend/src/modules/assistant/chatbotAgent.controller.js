/**
 * Hybrid Chatbot Controller
 * Passerelle sécurisée vers Ollama pour les requêtes simples du widget frontend
 * (sans logique agentic complexe)
 */

import { queryOllama } from './ollama.client.js';
import logger from '../../utils/logger.js';

export const queryChatbotAgent = async (req, res) => {
  try {
    const { message } = req.body;

    // Validation
    if (!message || message.trim() === '') {
      return res
        .status(400)
        .json({ error: 'Le contenu du message ne peut pas être vide.' });
    }

    // Log pour audit (optionnel - vous pouvez ajouter userId ici)
    const userId = req.user?.id || 'anonymous';
    logger.info(`Chatbot query from user ${userId}`, { message: message.substring(0, 100) });

    // Appel direct au client Ollama (sans streaming)
    const response = await queryOllama(message);

    return res.status(200).json({
      response: response,
      model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
      success: true,
    });
  } catch (error) {
    logger.error('Erreur de liaison avec Ollama:', error.message);

    // Réponse d'erreur propre
    return res.status(500).json({
      error: 'Impossible de joindre l\'expert métier.',
      details: error.message,
    });
  }
};

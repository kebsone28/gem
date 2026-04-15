import prisma from '../../core/utils/prisma.js';
import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';
import { redisConnection } from '../../core/utils/queueManager.js';
import crypto from 'crypto';
import { MissionSageService } from './MissionSageService.js';
import { queryOllama } from './ollama.client.js';
import { createAgent } from './agent/agentFactory.js';
import { vectorMemoryService } from './VectorMemoryService.js';
import { initializeAIRouter, getAIRouter } from './services/AIRouterService.js';

const missionSage = new MissionSageService();

// Initialize AI Router with circuit breakers and fallback strategy
// This will be called once on first use
let aiRouterInitialized = false;

const SYSTEM_PROMPT = `Tu es un assistant intelligent intégré à une application professionnelle (PROQUELEC / Mission Sage).

Règles principales :

- Tu es humain, naturel et simple
- Tu expliques sans jargon inutile
- Tu adaptes ton ton à l’émotion utilisateur
- Tu peux utiliser un peu d’humour léger
- Tu rassures toujours l’utilisateur
- Tu donnes des réponses concrètes et actionnables

Style :
- court puis clair puis solution
- parfois empathique
- parfois technique
- jamais arrogant

Comportement :
- si l’utilisateur est stressé → calmer
- si l’utilisateur est perdu → simplifier
- si erreur technique → expliquer + solution
- si casual → réponse légère

Interdictions :
- pas de réponses froides
- pas de texte trop long inutilement
- pas de langage technique sans explication

Signature implicite :
"on simplifie et on avance"
`;

const OPENAI_API_URL = `${config.ai.openaiBaseUrl}/chat/completions`;
const MODEL = config.ai.model || 'gpt-4o-mini';
const MAX_TOKENS = Number(config.ai.maxTokens) || 700;
const TEMPERATURE = Number(config.ai.temperature) || 0.3;
const CACHE_TTL_SECONDS = Number(config.ai.cacheTtlSeconds) || 300;
const localCache = new Map();

function hashMessage(message) {
  return crypto.createHash('sha256').update(String(message || '')).digest('hex');
}

function getLocalCache(key) {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    localCache.delete(key);
    return null;
  }
  return entry.value;
}

function setLocalCache(key, value) {
  localCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000
  });
}

async function getCachedResponse(key) {
  if (redisConnection) {
    try {
      const value = await redisConnection.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.warn('Redis cache read failed', { error: err.message });
    }
  }

  return getLocalCache(key);
}

async function setCachedResponse(key, payload) {
  if (redisConnection) {
    try {
      await redisConnection.setex(key, CACHE_TTL_SECONDS, JSON.stringify(payload));
      return;
    } catch (err) {
      logger.warn('Redis cache write failed', { error: err.message });
    }
  }

  setLocalCache(key, payload);
}

function selectModel(message, context = {}) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.length < 40) return 'local';

  const technicalPattern = /\b(code|erreur|bug|debug|débogage|stack|exception|compile|compilation|script|deploy|déploiement)\b/i;
  const criticalPattern = /\b(critique|urgent|prioritaire|important|audit|stratégie|complexe|compliqué|sécurité|bloquant)\b/i;

  if (context.requiresHighAccuracy || criticalPattern.test(normalized)) return 'openai';
  if (technicalPattern.test(normalized)) return 'ollama';

  return 'ollama';
}

function detectIntent(message) {
  if (/bonjour|salut|hello/i.test(message)) return 'greeting';
  if (/erreur|bug|problème|cassé|incident|panne/i.test(message)) return 'technical_issue';
  if (/analyse|analyse des données|données|statistique|consommation|anomalie|anomalies|kpi|kpis/i.test(message)) return 'data_analysis';
  if (/fatigu[eé]|stress|angoisse|frustr(e|é)|énervé|col[èe]re|perdu/i.test(message)) return 'emotion_support';
  if (/comment|aide|expliquer|tutoriel|procédure|pourquoi/i.test(message)) return 'help_request';
  if (/plan|priorité|objectif|checklist|productivité|productif/i.test(message)) return 'productivity';
  return 'casual_chat';
}

function selectAgent(intent) {
  if (intent === 'technical_issue') return 'TechAgent';
  if (intent === 'help_request' || intent === 'productivity' || intent === 'greeting') return 'SupportAgent';
  if (intent === 'data_analysis') return 'DataAgent';
  return 'SupportAgent';
}

function detectEmotion(message) {
  if (/stress|press[eé]|tension|angoisse/i.test(message)) return 'stressed';
  if (/fatigu[eé]|crev[eé]|épuis[eé]/i.test(message)) return 'tired';
  if (/énervé|col[èe]re|furieux|frustr(e|é)/i.test(message)) return 'frustrated';
  if (/perdu|confus|pas compris/i.test(message)) return 'confused';
  return 'neutral';
}

function selectRoute(intent) {
  if (intent === 'casual_chat') return 'local';
  if (intent === 'technical_issue') return 'ai';
  if (intent === 'emotion_support') return 'hybrid';
  if (intent === 'help_request') return 'ai';
  return 'ai';
}

function buildPrompt(message, memory, intent, emotion) {
  return `Message: ${message}\nIntent: ${intent}\nEmotion: ${emotion}\nUser memory: ${JSON.stringify(memory || {})}`;
}

function buildOllamaPrompt(message, memory, intent, emotion) {
  return `Tu es un assistant technique spécialisé.

Réponds de manière claire, structurée et concise.

Toujours :
- expliquer simplement
- donner des étapes
- éviter le blabla

Contexte : ${JSON.stringify(memory || {})}

Question : ${message}`;
}

function humanize(text, emotion) {
  const hooks = [
    'on va faire ça proprement 😄',
    'pas de panique 👍',
    'on simplifie tout ça',
    'bonne question 🔧'
  ];
  const random = hooks[Math.floor(Math.random() * hooks.length)];

  if (emotion === 'stressed') {
    return `Respire 😌 ${text} ${random}`;
  }
  if (emotion === 'frustrated') {
    return `Je comprends 😄 ${text} ${random}`;
  }
  if (emotion === 'confused') {
    return `Je simplifie ça pour toi : ${text} ${random}`;
  }

  return `${text} ${random}`;
}

async function callLLM(message, memory, intent, emotion) {
  if (!config.ai.openaiKey) {
    throw new Error('OpenAI API key is not configured.');
  }

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(message, memory, intent, emotion) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.openaiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const errorMessage = `OpenAI error ${response.status}: ${errorBody}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Initialize AI Router with circuit breakers
 */
function ensureAIRouterInitialized() {
  if (aiRouterInitialized) return;
  
  try {
    // Create wrapped query function for Ollama
    const ollamaQuery = async (prompt) => {
      return await queryOllama(prompt);
    };

    // Initialize router - 100% FREE version (Ollama + MissionSage, NO OpenAI)
    initializeAIRouter(missionSage, ollamaQuery);
    aiRouterInitialized = true;
    
    logger.info('✅ AI Router initialized - 100% FREE (Ollama + MissionSage, NO OpenAI costs)');
  } catch (error) {
    logger.error('Failed to initialize AI Router', { error: error.message });
    throw error;
  }
}

export const assistantService = {
  async handleQuery(userId, message, requestContext = {}) {
    // Ensure AI Router is initialized (one-time setup)
    ensureAIRouterInitialized();
    
    const memory = await this.getMemory(userId);
    const intent = detectIntent(message);
    const emotion = detectEmotion(message);
    const agentName = selectAgent(intent);
    const mergedContext = { ...(memory?.context || {}), ...(requestContext || {}), intent, emotion };

    const semanticContext = await vectorMemoryService.findRelevantContext(userId, message, 0.72);
    if (semanticContext.found) {
      logger.info('Using semantic context for query', {
        userId,
        agentName,
        contextCount: semanticContext.context.length
      });
    }

    const cacheKey = `assistant:response:${userId}:${hashMessage(message + JSON.stringify(mergedContext))}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      logger.info('AI response cache hit', { userId, agentName });
      return cached;
    }

    let response = '';
    let route = 'local';
    let model = 'missionSage';
    let circuitState = {};
    let requestMetrics = {};

    const enrichedMemory = {
      ...memory,
      semanticContext: semanticContext.context || []
    };

    try {
      // Use greedings and casual chat for local-only (no circuit breaker needed)
      if (intent === 'greeting' || intent === 'casual_chat') {
        response = missionSage.answer(message);
        route = 'local';
        model = 'missionSage';
      } else {
        // For complex queries, use agents with AI Router support
        const agent = createAgent(agentName);
        
        // Get AI Router reference
        try {
          const aiRouter = getAIRouter();
          circuitState = aiRouter.getCircuitStates();
          requestMetrics = {
            circuitHealth: aiRouter.getHealthStatus(),
            metrics: aiRouter.getDetailedMetrics()
          };
        } catch (err) {
          logger.debug('AI Router metrics unavailable', { error: err.message });
        }

        response = await agent.execute(message, {
          userId,
          memory: enrichedMemory,
          context: mergedContext,
          organizationId: memory?.organizationId
        });
        route = 'agent';
        model = agentName;
      }

      response = humanize(response, emotion);
      await this.updateMemory(userId, message, intent);

      if (route === 'agent') {
        await vectorMemoryService.storeConversation(userId, null, message, response, intent);
      }

      const result = {
        response,
        intent,
        emotion,
        route,
        model,
        agent: agentName,
        semanticContext: semanticContext.context,
        circuitState,
        ...(Object.keys(requestMetrics).length > 0 && { requestMetrics })
      };

      await setCachedResponse(cacheKey, result);
      return result;

    } catch (error) {
      logger.error('Query handling failed', { userId, error: error.message });
      
      // Fallback to MissionSage on error
      const fallbackResponse = missionSage.answer(message);
      await this.updateMemory(userId, message, intent);

      return {
        response: fallbackResponse,
        intent,
        emotion,
        route: 'fallback',
        model: 'missionSage',
        agent: 'fallback',
        semanticContext: [],
        error: error.message,
        circuitState,
        warning: 'Using fallback due to error'
      };
    }
  },

  async getMemory(userId) {
    if (!userId) return null;
    return prisma.userMemory.findUnique({ where: { userId } });
  },

  async updateMemory(userId, message, intent) {
    if (!userId) return null;
    return prisma.userMemory.upsert({
      where: { userId },
      update: {
        lastMessage: message,
        lastIntent: intent,
        updatedAt: new Date()
      },
      create: {
        userId,
        lastMessage: message,
        lastIntent: intent
      }
    });
  },

  async saveUserMemory(userId, memory, organizationId) {
    if (!userId || typeof memory !== 'object') return null;
    return prisma.userMemory.upsert({
      where: { userId },
      update: {
        preferences: memory.preferences || undefined,
        history: memory.history || undefined,
        emotions: memory.emotions || undefined,
        context: memory.context || undefined,
        updatedAt: new Date()
      },
      create: {
        userId,
        preferences: memory.preferences || {},
        history: memory.history || [],
        emotions: memory.emotions || {},
        context: memory.context || {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  },

  async loadUserMemory(userId) {
    if (!userId) return null;
    return prisma.userMemory.findUnique({ where: { userId } });
  }
};

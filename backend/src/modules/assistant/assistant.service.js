/* eslint-disable @typescript-eslint/no-unused-vars */
import prisma from '../../core/utils/prisma.js';
import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';
import { redisConnection } from '../../core/utils/queueManager.js';
import crypto from 'crypto';
import { MissionSageService } from './MissionSageService.js';
import { queryOllama } from './ollama.client.js';
import { createAgent } from './agent/agentFactory.js';
import { vectorMemoryService } from './VectorMemoryService.js';
import { initializeAIRouter } from './services/AIRouterService.js';
import { buildSystemPrompt } from '../../core/config/ai_registry.js';

const missionSage = new MissionSageService();
let aiRouterInitialized = false;

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

function detectIntent(message) {
  const text = String(message || '').toLowerCase();
  if (/bonjour|salut|hello/i.test(text)) return 'greeting';
  if (/erreur|bug|problème|cassé|incident|panne/i.test(text)) return 'technical_issue';
  if (/analyse|données|statistique|consommation|anomalie|kpi/i.test(text)) return 'data_analysis';
  if (/fatigu[eé]|stress|angoisse|frustr[eé]|énervé|col[èe]re|perdu/i.test(text)) return 'emotion_support';
  if (/comment|aide|expliquer|tutoriel|procédure|pourquoi|norme|standard/i.test(text)) return 'help_request';
  if (/plan|priorité|objectif|checklist|productivité/i.test(text)) return 'productivity';
  return 'casual_chat';
}

function selectAgent(intent) {
  if (intent === 'technical_issue') return 'TechAgent';
  if (intent === 'help_request' || intent === 'productivity' || intent === 'greeting') return 'SupportAgent';
  if (intent === 'data_analysis') return 'DataAgent';
  return 'SupportAgent';
}

function detectEmotion(message) {
  const text = String(message || '').toLowerCase();
  if (/stress|press[eé]|tension|angoisse/i.test(text)) return 'stressed';
  if (/fatigu[eé]|crev[eé]|épuis[eé]/i.test(text)) return 'tired';
  if (/énervé|col[èe]re|furieux|frustr[eé]/i.test(text)) return 'frustrated';
  if (/perdu|confus|pas compris/i.test(text)) return 'confused';
  return 'neutral';
}

function applyHumanization(text, emotion) {
  const hooks = [
    'on va faire ça proprement 😄',
    'pas de panique 👍',
    'on simplifie tout ça',
    'bonne question 🔧'
  ];
  const random = hooks[Math.floor(Math.random() * hooks.length)];

  if (emotion === 'stressed') return `Respire 😌 ${text} ${random}`;
  if (emotion === 'frustrated') return `Je comprends 😄 ${text} ${random}`;
  if (emotion === 'confused') return `Je simplifie ça pour toi : ${text} ${random}`;

  return `${text} ${random}`;
}

function ensureAIRouterInitialized() {
  if (aiRouterInitialized) return;
  try {
    const ollamaQuery = async (prompt) => await queryOllama(prompt);
    initializeAIRouter(missionSage, ollamaQuery);
    aiRouterInitialized = true;
    logger.info('✅ AI Router initialized - 100% FREE (Ollama + MissionSage)');
  } catch (error) {
    logger.error('Failed to initialize AI Router', { error: error.message });
  }
}

export const assistantService = {
  /**
   * processQuery - Main entry point for AI interactions (Multi-tenant)
   */
  async processQuery({ user, userId, message, context = {}, offlineMode = false }) {
    ensureAIRouterInitialized();
    const start = Date.now();
    
    const intent = detectIntent(message);
    const emotion = detectEmotion(message);
    const orgName = user?.organizationName || 'GEM SAAS';
    const sector = user?.projectSector || 'elec_bt';
    
    const memory = await this.loadUserMemory(userId);
    const semanticContext = await vectorMemoryService.findRelevantContext(userId, message, 0.72);
    
    const mergedContext = { 
      ...(memory?.context || {}), 
      ...context, 
      intent, 
      emotion, 
      organizationName: orgName,
      projectSector: sector,
      systemPrompt: buildSystemPrompt(orgName, sector)
    };

    const cacheKey = `assistant:response:${userId}:${hashMessage(message + JSON.stringify(mergedContext))}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) return cached;

    let responseText = '';
    let source = 'local';
    let agentName = selectAgent(intent);

    try {
      if (offlineMode || intent === 'greeting' || intent === 'casual_chat') {
        responseText = missionSage.answer(message, orgName);
        source = 'local';
      } else {
        const agent = createAgent(agentName);
        const agentResult = await agent.execute(message, {
          userId,
          memory: { ...memory, semanticContext: semanticContext.context || [] },
          context: mergedContext,
          organizationId: user?.organizationId,
          organizationName: orgName
        });
        
        // Extract readable response from agent result
        responseText = agentResult.summary || agentResult.message || 'Mission accomplie.';
        source = agentResult.success ? 'agent' : 'fallback';
      }

      responseText = applyHumanization(responseText, emotion);
      
      // Memory persistence
      await this.saveUserMemory(userId, {
        history: [...(memory?.history || []), { q: message, a: responseText, t: new Date() }].slice(-10)
      });

      if (source === 'agent') {
        await vectorMemoryService.storeConversation(userId, user?.organizationId, message, responseText, intent);
      }

      const duration = Date.now() - start;
      const result = {
        response: responseText,
        intent,
        emotion,
        source,
        agent: agentName,
        latencyMs: duration
      };

      await setCachedResponse(cacheKey, result);
      return result;

    } catch (error) {
      logger.error('Query handling failed', { userId, error: error.message });
      const fallback = missionSage.answer(message, orgName);
      return {
        response: applyHumanization(fallback, emotion),
        intent,
        emotion,
        source: 'fallback',
        latencyMs: Date.now() - start,
        error: error.message
      };
    }
  },

  async loadUserMemory(userId) {
    if (!userId) return null;
    return prisma.userMemory.findUnique({ where: { userId } });
  },

  async saveUserMemory(userId, memoryPayload) {
    if (!userId) return null;
    const data = {
      preferences: memoryPayload.preferences || undefined,
      history: memoryPayload.history || undefined,
      updatedAt: new Date()
    };
    return prisma.userMemory.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data }
    });
  }
};

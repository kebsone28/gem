import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { config } from '../../core/config/config.js';

/**
 * OpenAI Embedding Pipeline
 * Convert text → vectors for semantic search
 */
export class EmbeddingService {
  async embedText(text) {
    if (!config.ai.openaiKey) {
      throw new Error('OpenAI API key is not configured for embeddings.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.ai.openaiKey}`
        },
        body: JSON.stringify({
          input: text.substring(0, 8000), // Limit to 8k chars
          model: 'text-embedding-3-small' // Cost-optimized
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embedding error ${response.status}: ${error}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error('Embedding failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch embed multiple texts (more cost-efficient)
   */
  async embedBatch(texts) {
    if (!config.ai.openaiKey) {
      throw new Error('OpenAI API key is not configured for embeddings.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.ai.openaiKey}`
        },
        body: JSON.stringify({
          input: texts.map((t) => t.substring(0, 8000)),
          model: 'text-embedding-3-small'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI batch embedding error ${response.status}: ${error}`);
      }

      const data = await response.json();
      return data.data.map((item) => item.embedding);
    } catch (error) {
      logger.error('Batch embedding failed', { error: error.message });
      throw error;
    }
  }
}

/**
 * Vector Memory Storage & Semantic Search
 * Uses pgvector for PostgreSQL vector operations
 */
export class VectorMemoryService {
  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Store a text with its embedding in PostgreSQL pgvector
   */
  async storeMemory(userId, organizationId, text, intent, metadata = {}) {
    try {
      // Get embedding
      const embedding = await this.embeddingService.embedText(text);

      // Store in database
      const memory = await prisma.vectorMemory.create({
        data: {
          userId,
          userMemoryId: await this.ensureUserMemoryId(userId),
          organizationId,
          content: text,
          embedding,
          intent,
          metadata
        }
      });

      logger.info('Memory stored', { userId, memoryId: memory.id });
      return memory;
    } catch (error) {
      logger.error('Store memory failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Semantic search: find similar memories using vector similarity
   * Returns top K similar results
   */
  async semanticSearch(userId, query, topK = 5) {
    try {
      // Get query embedding
      const queryEmbedding = await this.embeddingService.embedText(query);

      // Raw SQL query using pgvector cosine similarity
      const memories = await prisma.vectorMemory.findMany({
        where: { userId },
        select: {
          id: true,
          content: true,
          intent: true,
          metadata: true,
          createdAt: true,
          embedding: true
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      const similarity = (a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
        const dot = a.reduce((sum, val, idx) => sum + val * (b[idx] || 0), 0);
        const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return normA && normB ? dot / (normA * normB) : 0;
      };

      const scored = memories
        .map((item) => ({
          ...item,
          similarity: similarity(item.embedding, queryEmbedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      logger.info('Semantic search completed', { userId, resultsCount: scored.length });
      return scored;
    } catch (error) {
      logger.error('Semantic search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Find relevant context for a user's query
   * Used by AI Router to provide context without LLM call
   */
  async findRelevantContext(userId, query, threshold = 0.7) {
    try {
      const results = await this.semanticSearch(userId, query, 10);
      const relevant = results.filter((r) => r.similarity >= threshold);

      return {
        found: relevant.length > 0,
        context: relevant.map((r) => ({
          content: r.content,
          intent: r.intent,
          similarity: parseFloat(r.similarity.toFixed(3)),
          metadata: r.metadata
        }))
      };
    } catch (error) {
      logger.error('Find relevant context failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Store conversation history in vector memory
   * Enables long-term context retention
   */
  async storeConversation(userId, organizationId, userMessage, assistantResponse, intent) {
    try {
      await this.storeMemory(
        userId,
        organizationId,
        `Q: ${userMessage}\nA: ${assistantResponse}`,
        intent,
        { type: 'conversation', timestamp: new Date() }
      );

      logger.info('Conversation stored', { userId });
    } catch (error) {
      logger.error('Store conversation failed', { error: error.message });
      throw error;
    }
  }

  async ensureUserMemoryId(userId) {
    const existing = await prisma.userMemory.findUnique({ where: { userId } });
    if (existing) return existing.id;
    const created = await prisma.userMemory.create({ data: { userId } });
    return created.id;
  }

  /**
   * Clean old memories (memory compression)
   */
  async cleanOldMemories(userId, daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deleted = await prisma.vectorMemory.deleteMany({
        where: {
          userId,
          createdAt: { lt: cutoffDate }
        }
      });

      logger.info('Old memories cleaned', { userId, deletedCount: deleted.count });
      return deleted.count;
    } catch (error) {
      logger.error('Clean old memories failed', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
export const vectorMemoryService = new VectorMemoryService();

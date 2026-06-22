/**
 * 🤖 AutoTrainingSystem - Système d'auto-entraînement amélioré pour l'IA
 * Mécanismes d'apprentissage automatique basés sur les interactions utilisateur
 */

import { db } from '../../store/db';
import type { AIResponse } from './MissionSageService';
import logger from '../logger';

// ─────────────────────────────────────────────
// TYPES POUR L'APPRENTISSAGE
// ─────────────────────────────────────────────

export interface UserFeedback {
  id?: number;
  query: string;
  response: string;
  rating: 'positive' | 'negative' | 'neutral';
  userId: string;
  role: string;
  timestamp: number;
  reason?: string;
  improvedAnswer?: string;
}

export interface InteractionPattern {
  id?: number;
  pattern: string;
  frequency: number;
  lastSeen: number;
  suggestedTrainingEntry?: {
    question: string;
    answer: string;
  };
  confidence: number;
}

export interface TrainingSuggestion {
  id: string;
  question: string;
  suggestedAnswer: string;
  source: 'user_feedback' | 'pattern_detection' | 'cross_validation' | 'referential_mining';
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
  metadata?: {
    pattern?: string;
    feedbackCount?: number;
    engineDiscrepancy?: string;
    referentialSource?: string;
  };
}

export interface LearningMetric {
  date: string;
  totalQueries: number;
  resolvedByRules: number;
  resolvedByClaude: number;
  fallbackCount: number;
  userSatisfaction: number;
  newTrainingEntries: number;
}

// ─────────────────────────────────────────────
// MÉCANISME 1: FEEDBACK UTILISATEUR
// ─────────────────────────────────────────────

export const userFeedbackService = {
  async recordFeedback(
    query: string,
    response: AIResponse,
    rating: 'positive' | 'negative' | 'neutral',
    userId: string,
    role: string,
    reason?: string
  ): Promise<void> {
    try {
      await db.user_feedback.add({
        query,
        response: response.message,
        rating,
        userId,
        role,
        timestamp: Date.now(),
        reason,
      });
    } catch (err) {
      logger.error('[UserFeedback] Failed to record feedback', err);
    }
  },

  async getNegativeFeedback(limit = 50): Promise<UserFeedback[]> {
    try {
      return await db.user_feedback
        .where('rating')
        .equals('negative')
        .reverse()
        .sortBy('timestamp')
        .then((items) => items.slice(0, limit));
    } catch {
      return [];
    }
  },

  async getSatisfactionRate(userId?: string): Promise<number> {
    try {
      const feedbacks = userId
        ? await db.user_feedback.where('userId').equals(userId).toArray()
        : await db.user_feedback.toArray();
      
      if (feedbacks.length === 0) return 0.5;
      
      const positive = feedbacks.filter((f) => f.rating === 'positive').length;
      return positive / feedbacks.length;
    } catch {
      return 0.5;
    }
  },

  async generateTrainingSuggestionsFromFeedback(): Promise<TrainingSuggestion[]> {
    const negativeFeedback = await this.getNegativeFeedback(100);
    const suggestions: TrainingSuggestion[] = [];

    // Grouper les feedbacks négatifs par similarité de question
    const grouped = new Map<string, UserFeedback[]>();
    
    for (const feedback of negativeFeedback) {
      const normalized = feedback.query.toLowerCase().trim();
      if (!grouped.has(normalized)) {
        grouped.set(normalized, []);
      }
      grouped.get(normalized)!.push(feedback);
    }

    // Générer des suggestions pour les questions avec beaucoup de feedbacks négatifs
    for (const [question, feedbacks] of grouped.entries()) {
      if (feedbacks.length >= 2) {
        suggestions.push({
          id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          question,
          suggestedAnswer: '[À améliorer par un expert humain]',
          source: 'user_feedback',
          confidence: Math.min(0.9, 0.5 + feedbacks.length * 0.1),
          priority: feedbacks.length >= 5 ? 'high' : 'medium',
          createdAt: Date.now(),
          metadata: {
            feedbackCount: feedbacks.length,
          },
        });
      }
    }

    return suggestions;
  },
};

// ─────────────────────────────────────────────
// MÉCANISME 2: DÉTECTION DE PATTERNS
// ─────────────────────────────────────────────

export const patternDetectionService = {
  async analyzeQueries(): Promise<InteractionPattern[]> {
    try {
      const logs = await db.ai_learning_logs.toArray();
      const patterns = new Map<string, { count: number; lastSeen: number; queries: string[] }>();

      // Extraire les patterns de requêtes
      for (const log of logs) {
        const words = log.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        
        for (let i = 0; i < words.length - 1; i++) {
          const bigram = `${words[i]} ${words[i + 1]}`;
          if (!patterns.has(bigram)) {
            patterns.set(bigram, { count: 0, lastSeen: 0, queries: [] });
          }
          patterns.get(bigram)!.count++;
          patterns.get(bigram)!.lastSeen = log.timestamp;
          patterns.get(bigram)!.queries.push(log.query);
        }
      }

      // Convertir en InteractionPattern
      return Array.from(patterns.entries())
        .filter(([_, data]) => data.count >= 3)
        .map(([pattern, data]) => ({
          pattern,
          frequency: data.count,
          lastSeen: data.lastSeen,
          confidence: Math.min(0.95, data.count * 0.15),
        }));
    } catch {
      return [];
    }
  },

  async generateTrainingSuggestionsFromPatterns(): Promise<TrainingSuggestion[]> {
    const patterns = await this.analyzeQueries();
    const suggestions: TrainingSuggestion[] = [];

    for (const pattern of patterns) {
      if (pattern.frequency >= 5 && pattern.confidence > 0.7) {
        suggestions.push({
          id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          question: pattern.pattern,
          suggestedAnswer: '[À générer automatiquement ou par expert]',
          source: 'pattern_detection',
          confidence: pattern.confidence,
          priority: pattern.frequency >= 10 ? 'high' : 'medium',
          createdAt: Date.now(),
          metadata: {
            pattern: pattern.pattern,
          },
        });
      }
    }

    return suggestions;
  },
};

// ─────────────────────────────────────────────
// MÉCANISME 3: VALIDATION CROISÉE MOTEURS
// ─────────────────────────────────────────────

export interface EngineComparison {
  query: string;
  rulesResponse?: AIResponse;
  claudeResponse?: AIResponse;
  similarity: number;
  shouldCreateTrainingEntry: boolean;
}

export const crossValidationService = {
  async compareEngines(query: string, rulesResponse: AIResponse, claudeResponse: AIResponse): Promise<EngineComparison> {
    // Calcul de similarité simple entre les réponses
    const similarity = this.calculateSimilarity(rulesResponse.message, claudeResponse.message);
    
    return {
      query,
      rulesResponse,
      claudeResponse,
      similarity,
      shouldCreateTrainingEntry: similarity < 0.5, // Si les réponses sont très différentes
    };
  },

  calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  },

  async generateTrainingSuggestionsFromDiscrepancies(): Promise<TrainingSuggestion[]> {
    // Cette fonction serait appelée quand il y a des divergences entre les moteurs
    // Pour l'instant, retourne un tableau vide
    // Dans un système complet, elle analyserait les logs de comparaison
    return [];
  },
};

// ─────────────────────────────────────────────
// MÉCANISME 4: MINAGE DE RÉFÉRENTIELS
// ─────────────────────────────────────────────

export const referentialMiningService = {
  async generateTrainingFromReferentials(): Promise<TrainingSuggestion[]> {
    // Générer automatiquement des entrées d'entraînement à partir des référentiels
    // comme ELECTRICIAN_GUIDE et KOBO_STANDARDS
    const suggestions: TrainingSuggestion[] = [];

    // Exemple: générer des questions à partir des définitions techniques
    const technicalDefinitions = [
      {
        domain: 'branchement_senelec',
        question: 'Quelle est la hauteur réglementaire du hublot du coffret compteur ?',
        answer: 'Le hublot du coffret doit être positionné à 1.60m du sol pour permettre une lecture facile et sécurisée.',
        source: 'Guide MFR - Chap 4',
      },
      {
        domain: 'protection_electrique',
        question: 'Quel est le rôle du DDR dans une installation électrique ?',
        answer: 'Le DDR (Dispositif Différentiel Résiduel) protège contre les contacts indirects en coupant automatiquement le circuit en cas de fuite de courant.',
        source: 'NS 01-001',
      },
      {
        domain: 'installation_interieur',
        question: 'Quelle est la configuration standard pour une installation intérieure MFR ?',
        answer: 'La configuration standard comprend: 3 lampes et 1 prise, avec le coffret disjoncteur dans un couloir couvert et les interrupteurs uniquement en zone couverte.',
        source: 'Guide MFR - Chap 3',
      },
    ];

    for (const def of technicalDefinitions) {
      suggestions.push({
        id: `referential-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: def.question,
        suggestedAnswer: def.answer,
        source: 'referential_mining',
        confidence: 0.95,
        priority: 'high',
        createdAt: Date.now(),
        metadata: {
          referentialSource: def.source,
        },
      });
    }

    return suggestions;
  },
};

// ─────────────────────────────────────────────
// MÉCANISME 5: MÉTRIQUES D'APPRENTISSAGE
// ─────────────────────────────────────────────

export const learningMetricsService = {
  async calculateDailyMetrics(date: Date = new Date()): Promise<LearningMetric> {
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const logs = await db.ai_learning_logs.toArray();
      const dayLogs = logs.filter((log) => {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      const feedback = await db.user_feedback.toArray();
      const dayFeedback = feedback.filter((f) => {
        const feedbackDate = new Date(f.timestamp).toISOString().split('T')[0];
        return feedbackDate === dateStr;
      });

      const satisfaction = await userFeedbackService.getSatisfactionRate();

      return {
        date: dateStr,
        totalQueries: dayLogs.length,
        resolvedByRules: dayLogs.length,
        resolvedByClaude: 0,
        fallbackCount: 0,
        userSatisfaction: satisfaction,
        newTrainingEntries: 0,
      };
    } catch {
      return {
        date: dateStr,
        totalQueries: 0,
        resolvedByRules: 0,
        resolvedByClaude: 0,
        fallbackCount: 0,
        userSatisfaction: 0.5,
        newTrainingEntries: 0,
      };
    }
  },

  async getWeeklyTrends(): Promise<LearningMetric[]> {
    const trends: LearningMetric[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      trends.push(await this.calculateDailyMetrics(date));
    }

    return trends;
  },
};

// ─────────────────────────────────────────────
// SYSTÈME UNIFIÉ D'AUTO-ENTRAÎNEMENT
// ─────────────────────────────────────────────

export const autoTrainingSystem = {
  async generateAllSuggestions(): Promise<TrainingSuggestion[]> {
    const [
      feedbackSuggestions,
      patternSuggestions,
      referentialSuggestions,
    ] = await Promise.all([
      userFeedbackService.generateTrainingSuggestionsFromFeedback(),
      patternDetectionService.generateTrainingSuggestionsFromPatterns(),
      referentialMiningService.generateTrainingFromReferentials(),
    ]);

    return [...feedbackSuggestions, ...patternSuggestions, ...referentialSuggestions]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50); // Limiter à 50 suggestions
  },

  async getLearningStatus(): Promise<{
    totalFeedbacks: number;
    negativeFeedbacks: number;
    satisfactionRate: number;
    patternsDetected: number;
    pendingSuggestions: number;
  }> {
    const [negativeList, satisfactionRate, patterns, totalFeedbacks] = await Promise.all([
      userFeedbackService.getNegativeFeedback(1000),
      userFeedbackService.getSatisfactionRate(),
      patternDetectionService.analyzeQueries(),
      db.user_feedback.count().catch(async () => (await db.user_feedback.toArray()).length),
    ]);

    const suggestions = await this.generateAllSuggestions();

    return {
      totalFeedbacks,
      negativeFeedbacks: negativeList.length,
      satisfactionRate,
      patternsDetected: patterns.length,
      pendingSuggestions: suggestions.length,
    };
  },
};

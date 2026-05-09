import { getAIEngineConfig, saveAIEngineConfig, type AIEngineSettings } from './AIEngineConfig';
import type { User } from '../../utils/types';
import type { AIResponse, AIState } from './MissionSageService';
import { missionSageService } from './MissionSageService';
import { enrichResponse } from './responseEnricher';
import {
  autoTrainingSystem,
  userFeedbackService,
  learningMetricsService,
  type TrainingSuggestion,
  type LearningMetric,
  type UserFeedback,
} from './autoTrainingSystem';
import { mentorTrainingService } from './mentorTrainingService';
import type { DomaineTechnique } from './referentialTypes';

// Réexport des types depuis autoTrainingSystem
export type { TrainingSuggestion, LearningMetric, UserFeedback };

// ─────────────────────────────────────────────
// TYPES DU CERVEAU IA
// ─────────────────────────────────────────────

// On utilise désormais AIEngineSettings de AIEngineConfig.ts
export type GEMAICoreConfig = AIEngineSettings;

export interface GEMAIState {
  isThinking: boolean;
  lastQuery: string;
  lastResponse: AIResponse | null;
  learningStatus: {
    totalFeedbacks: number;
    negativeFeedbacks: number;
    satisfactionRate: number;
    patternsDetected: number;
    pendingSuggestions: number;
  };
  metrics: LearningMetric[];
  trainingSuggestions: TrainingSuggestion[];
}

export interface GEMAIRequest {
  query: string;
  user: User | null;
  context?: AIState;
  options?: {
    enableEnrichment?: boolean;
    enableTraining?: boolean;
    domain?: DomaineTechnique;
  };
}

export interface GEMAIResponse {
  response: AIResponse;
  enriched: boolean;
  confidence: number;
  suggestions?: TrainingSuggestion[];
  metrics?: LearningMetric;
}

// ─────────────────────────────────────────────
// CERVEAU CENTRALISÉ
// ─────────────────────────────────────────────

export class GEMAICore {
  private state: GEMAIState;
  private initialized: boolean = false;

  constructor() {
    this.state = {
      isThinking: false,
      lastQuery: '',
      lastResponse: null,
      learningStatus: {
        totalFeedbacks: 0,
        negativeFeedbacks: 0,
        satisfactionRate: 0.5,
        patternsDetected: 0,
        pendingSuggestions: 0,
      },
      metrics: [],
      trainingSuggestions: [],
    };
  }

  // ─────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const config = getAIEngineConfig();
    try {
      // Charger les métriques et suggestions initiales
      const [metrics, suggestions, learningStatus] = await Promise.all([
        config.enableLearningMetrics ? learningMetricsService.getWeeklyTrends() : [],
        config.enableAutoTraining ? autoTrainingSystem.generateAllSuggestions() : [],
        autoTrainingSystem.getLearningStatus(),
      ]);

      this.state.metrics = metrics;
      this.state.trainingSuggestions = suggestions.slice(0, config.maxTrainingSuggestions);
      this.state.learningStatus = learningStatus;

      this.initialized = true;
    } catch (err) {
      console.error('[GEMAICore] Initialization failed', err);
    }
  }

  // ─────────────────────────────────────────────
  // TRAITEMENT DES REQUÊTES PRINCIPAL
  // ─────────────────────────────────────────────

  async processRequest(request: GEMAIRequest): Promise<GEMAIResponse> {
    const { query, user, context, options = {} } = request;
    const config = getAIEngineConfig();

    this.state.isThinking = true;
    this.state.lastQuery = query;

    try {
      // 1. Obtenir la réponse de base via MissionSage
      const baseResponse = await missionSageService.processQuery(
        query,
        user,
        context || { stats: null, auditLogs: [], households: [], teams: [], regionalSummaries: [] }
      );

      // 2. Enrichir la réponse si activé
      let enrichedResponse = baseResponse;
      let enriched = false;
      
      if (config.enableResponseEnrichment && options.enableEnrichment !== false) {
        enrichedResponse = enrichResponse(baseResponse, {
          roleUtilisateur: user?.role,
          moduleActif: options.domain,
        });
        enriched = true;
      }

      // 3. Calculer la confiance
      const confidence = this.calculateConfidence(enrichedResponse, user);

      // 4. Enregistrer l'apprentissage si activé
      if (config.enableAutoTraining && options.enableTraining !== false) {
        await this.recordLearning(query, enrichedResponse, user);
      }

      // 5. Obtenir des suggestions pertinentes
      const suggestions = this.getRelevantSuggestions(query, enrichedResponse.domaine);

      // 6. Obtenir les métriques actuelles
      const metrics = config.enableLearningMetrics 
        ? await learningMetricsService.calculateDailyMetrics()
        : undefined;

      this.state.lastResponse = enrichedResponse;
      this.state.isThinking = false;

      return {
        response: enrichedResponse,
        enriched,
        confidence,
        suggestions,
        metrics,
      };
    } catch (err) {
      this.state.isThinking = false;
      console.error('[GEMAICore] Request processing failed', err);
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // FEEDBACK UTILISATEUR
  // ─────────────────────────────────────────────

  async recordFeedback(
    query: string,
    response: AIResponse,
    rating: 'positive' | 'negative' | 'neutral',
    user: User | null,
    reason?: string
  ): Promise<void> {
    const config = getAIEngineConfig();
    if (!config.enableUserFeedback || !user) return;

    await userFeedbackService.recordFeedback(
      query,
      response,
      rating,
      user.email || user.id || 'anonymous',
      user.role || 'USER',
      reason
    );

    // Mettre à jour le statut d'apprentissage
    await this.updateLearningStatus();
  }

  // ─────────────────────────────────────────────
  // GESTION DE L'APPRENTISSAGE
  // ─────────────────────────────────────────────

  private async recordLearning(query: string, response: AIResponse, user: User | null): Promise<void> {
    // L'apprentissage est déjà géré par MissionSageService via logMissionSageLearningEvent
    // Cette méthode peut être étendue pour enregistrer des métadonnées supplémentaires
  }

  private async updateLearningStatus(): Promise<void> {
    const status = await autoTrainingSystem.getLearningStatus();
    this.state.learningStatus = status;
  }

  // ─────────────────────────────────────────────
  // SUGGESTIONS D'ENTRAÎNEMENT
  // ─────────────────────────────────────────────

  async generateTrainingSuggestions(): Promise<TrainingSuggestion[]> {
    const config = getAIEngineConfig();
    if (!config.enableAutoTraining) return [];

    const suggestions = await autoTrainingSystem.generateAllSuggestions();
    this.state.trainingSuggestions = suggestions.slice(0, config.maxTrainingSuggestions);
    
    return this.state.trainingSuggestions;
  }

  async acceptTrainingSuggestion(suggestion: TrainingSuggestion, user: User): Promise<void> {
    try {
      await mentorTrainingService.saveEntry({
        question: suggestion.question,
        answer: suggestion.suggestedAnswer || '[À compléter par un expert]',
      });

      // Retirer de la liste des suggestions
      this.state.trainingSuggestions = this.state.trainingSuggestions.filter(
        (s) => s.id !== suggestion.id
      );
    } catch (err) {
      console.error('[GEMAICore] Failed to accept training suggestion', err);
      throw err;
    }
  }

  async rejectTrainingSuggestion(suggestionId: string): Promise<void> {
    this.state.trainingSuggestions = this.state.trainingSuggestions.filter(
      (s) => s.id !== suggestionId
    );
  }

  private getRelevantSuggestions(query: string, domain?: DomaineTechnique): TrainingSuggestion[] {
    let relevant = this.state.trainingSuggestions;

    // Filtrer par domaine si spécifié
    if (domain) {
      relevant = relevant.filter((s) => {
        // Filtrer basé sur les métadonnées ou le contenu de la question
        return s.question.toLowerCase().includes(domain.toLowerCase());
      });
    }

    // Filtrer par similarité avec la requête actuelle
    const queryWords = query.toLowerCase().split(/\s+/);
    relevant = relevant.filter((s) => {
      const suggestionWords = s.question.toLowerCase().split(/\s+/);
      const intersection = queryWords.filter((w) => suggestionWords.includes(w));
      return intersection.length >= 2;
    });

    return relevant.slice(0, 5);
  }

  // ─────────────────────────────────────────────
  // MÉTRIQUES ET ANALYTIQUES
  // ─────────────────────────────────────────────

  async getMetrics(): Promise<LearningMetric[]> {
    const config = getAIEngineConfig();
    if (!config.enableLearningMetrics) return [];

    const metrics = await learningMetricsService.getWeeklyTrends();
    this.state.metrics = metrics;
    
    return metrics;
  }

  async getSatisfactionRate(userId?: string): Promise<number> {
    return await userFeedbackService.getSatisfactionRate(userId);
  }

  async getLearningStatus() {
    await this.updateLearningStatus();
    return this.state.learningStatus;
  }

  // ─────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────

  private calculateConfidence(response: AIResponse, user: User | null): number {
    let confidence = 0.5;

    // Augmenter la confiance si la réponse a des références normatives
    if (response.referencesCitees && response.referencesCitees.length > 0) {
      confidence += 0.2;
    }

    // Augmenter la confiance si la réponse a un verdict
    if (response.verdict) {
      confidence += 0.1;
    }

    // Augmenter la confiance si la réponse vient d'un moteur spécifique
    if (response._engine === 'RULES') {
      confidence += 0.15;
    }

    // Augmenter la confiance si l'utilisateur a un rôle élevé
    if (user && (user.role === 'DG_PROQUELEC' || user.role === 'DIRECTEUR')) {
      confidence += 0.05;
    }

    return Math.min(1, confidence);
  }

  getState(): GEMAIState {
    return { ...this.state };
  }

  getConfig(): GEMAICoreConfig {
    return getAIEngineConfig();
  }

  updateConfig(newConfig: Partial<GEMAICoreConfig>): void {
    // On utilise l'email système ou admin pour la trace
    saveAIEngineConfig(newConfig, 'system@gem-saas.com');
  }

  reset(): void {
    this.state = {
      isThinking: false,
      lastQuery: '',
      lastResponse: null,
      learningStatus: {
        totalFeedbacks: 0,
        negativeFeedbacks: 0,
        satisfactionRate: 0.5,
        patternsDetected: 0,
        pendingSuggestions: 0,
      },
      metrics: [],
      trainingSuggestions: [],
    };
  }
}

// ─────────────────────────────────────────────
// INSTANCE UNIQUE (SINGLETON)
// ─────────────────────────────────────────────

let gemAICoreInstance: GEMAICore | null = null;

export function getGEMAICore(config?: Partial<GEMAICoreConfig>): GEMAICore {
  if (!gemAICoreInstance) {
    gemAICoreInstance = new GEMAICore(config);
  }
  
  return gemAICoreInstance;
}

export function resetGEMAICore(): void {
  if (gemAICoreInstance) {
    gemAICoreInstance.reset();
    gemAICoreInstance = null;
  }
}

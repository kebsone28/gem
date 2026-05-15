/**
 * 🪝 useGedOsAiCore - Hook React pour le cerveau IA centralisé
 * Fournit une interface facile pour utiliser GedOsAiCore dans les composants React
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../utils/types';
import type { AIState } from '../services/ai/MissionSageService';
import {
  getGedOsAiCore,
  type GedOsAiCoreConfig,
  type GedOsAiRequest,
  type GedOsAiResponse,
  type GedOsAiState,
  type TrainingSuggestion,
  type LearningMetric,
} from '../services/ai/GedOsAiCore';

export function useGedOsAiCore(config?: Partial<GedOsAiCoreConfig>) {
  const { user } = useAuth();
  const coreRef = useRef(getGedOsAiCore(config));
  const [state, setState] = useState<GedOsAiState>(coreRef.current.getState());
  const [initialized, setInitialized] = useState(false);

  // Initialisation du cerveau IA
  useEffect(() => {
    const initializeCore = async () => {
      await coreRef.current.initialize();
      setState(coreRef.current.getState());
      setInitialized(true);
    };

    initializeCore();
  }, []);

  // Mise à jour périodique du statut d'apprentissage
  useEffect(() => {
    if (!initialized) return;

    const interval = setInterval(async () => {
      const learningStatus = await coreRef.current.getLearningStatus();
      setState((prev) => ({ ...prev, learningStatus }));
    }, 30000); // Toutes les 30 secondes

    return () => clearInterval(interval);
  }, [initialized]);

  // Traitement d'une requête
  const processRequest = useCallback(
    async (query: string, context?: AIState, options?: GedOsAiRequest['options']): Promise<GedOsAiResponse> => {
      const request: GedOsAiRequest = {
        query,
        user: user || null,
        context,
        options,
      };

      const response = await coreRef.current.processRequest(request);
      setState(coreRef.current.getState());

      return response;
    },
    [user]
  );

  // Enregistrement d'un feedback
  const recordFeedback = useCallback(
    async (
      query: string,
      response: any,
      rating: 'positive' | 'negative' | 'neutral',
      reason?: string
    ) => {
      await coreRef.current.recordFeedback(query, response, rating, user || null, reason);
      setState(coreRef.current.getState());
    },
    [user]
  );

  // Génération de suggestions d'entraînement
  const generateTrainingSuggestions = useCallback(async (): Promise<TrainingSuggestion[]> => {
    const suggestions = await coreRef.current.generateTrainingSuggestions();
    setState(coreRef.current.getState());
    return suggestions;
  }, []);

  // Acceptation d'une suggestion
  const acceptTrainingSuggestion = useCallback(
    async (suggestion: TrainingSuggestion): Promise<void> => {
      if (!user) return;
      await coreRef.current.acceptTrainingSuggestion(suggestion, user);
      setState(coreRef.current.getState());
    },
    [user]
  );

  // Rejet d'une suggestion
  const rejectTrainingSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    await coreRef.current.rejectTrainingSuggestion(suggestionId);
    setState(coreRef.current.getState());
  }, []);

  // Obtention des métriques
  const getMetrics = useCallback(async (): Promise<LearningMetric[]> => {
    const metrics = await coreRef.current.getMetrics();
    setState(coreRef.current.getState());
    return metrics;
  }, []);

  // Obtention du taux de satisfaction
  const getSatisfactionRate = useCallback(async (): Promise<number> => {
    return await coreRef.current.getSatisfactionRate(user?.email);
  }, [user]);

  // Mise à jour de la configuration
  const updateConfig = useCallback((newConfig: Partial<GedOsAiCoreConfig>): void => {
    coreRef.current.updateConfig(newConfig);
  }, []);

  // Reset du cerveau IA
  const reset = useCallback((): void => {
    coreRef.current.reset();
    setState(coreRef.current.getState());
  }, []);

  return {
    // État
    state,
    initialized,
    isThinking: state.isThinking,
    lastQuery: state.lastQuery,
    lastResponse: state.lastResponse,
    learningStatus: state.learningStatus,
    metrics: state.metrics,
    trainingSuggestions: state.trainingSuggestions,

    // Actions
    processRequest,
    recordFeedback,
    generateTrainingSuggestions,
    acceptTrainingSuggestion,
    rejectTrainingSuggestion,
    getMetrics,
    getSatisfactionRate,
    updateConfig,
    reset,

    // Accès direct au core
    core: coreRef.current,
  };
}

// Hook simplifié pour le chat (MissionMentor)
export function useGedOsAiChat(context?: AIState) {
  const {
    processRequest,
    recordFeedback,
    isThinking,
    lastResponse,
    state,
  } = useGedOsAiCore();

  const sendMessage = useCallback(
    async (query: string, options?: GedOsAiRequest['options']) => {
      return await processRequest(query, context, options);
    },
    [processRequest, context]
  );

  const sendFeedback = useCallback(
    async (rating: 'positive' | 'negative' | 'neutral', reason?: string) => {
      if (!lastResponse) return;
      await recordFeedback(state.lastQuery, lastResponse, rating, reason);
    },
    [recordFeedback, state.lastQuery, lastResponse]
  );

  return {
    sendMessage,
    sendFeedback,
    isThinking,
    lastResponse,
  };
}

// Hook pour l'entraînement automatique
export function useGedOsAiTraining() {
  const {
    learningStatus,
    trainingSuggestions,
    generateTrainingSuggestions,
    acceptTrainingSuggestion,
    rejectTrainingSuggestion,
    getMetrics,
    getSatisfactionRate,
    state,
  } = useGedOsAiCore();

  const refreshSuggestions = useCallback(async () => {
    await generateTrainingSuggestions();
  }, [generateTrainingSuggestions]);

  const refreshMetrics = useCallback(async () => {
    await getMetrics();
  }, [getMetrics]);

  return {
    learningStatus,
    trainingSuggestions,
    refreshSuggestions,
    acceptTrainingSuggestion,
    rejectTrainingSuggestion,
    refreshMetrics,
    getSatisfactionRate,
    metrics: state.metrics,
  };
}

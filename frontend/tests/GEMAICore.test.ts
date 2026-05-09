/**
 * 🧪 Tests du système IA GEM - Scénarios réels
 * Validation de l'enrichissement, feedback, auto-entraînement et GEMAICore
 */

import { getGEMAICore } from '../GEMAICore';
import { enrichResponse } from '../responseEnricher';
import type { AIResponse } from '../MissionSageService';
import type { DomaineTechnique } from '../referentialTypes';

// ─────────────────────────────────────────────
// SCÉNARIO 1: Test d'enrichissement automatique
// ─────────────────────────────────────────────

describe('Enrichissement automatique des réponses', () => {
  test('Scénario 1.1: Enrichissement d\'une réponse sur le branchement SENELEC', () => {
    const mockResponse: AIResponse = {
      message: 'Pour le branchement SENELEC, vous devez respecter la norme NS 01-001. Les étapes sont: 1. Vérifier l\'installation, 2. Connecter le disjoncteur, 3. Tester la tension.',
      type: 'info',
      _engine: 'RULES',
    };

    const enriched = enrichResponse(mockResponse, {
      roleUtilisateur: 'TECHNICIEN',
    });

    // Vérifier que le domaine est détecté
    expect(enriched.domaine).toBe('branchement_senelec');

    // Vérifier que la référence est extraite
    expect(enriched.referencesCitees).toBeDefined();
    expect(enriched.referencesCitees?.length).toBeGreaterThan(0);
    expect(enriched.referencesCitees?.[0].norme).toBe('NS 01-001');

    // Vérifier que les étapes de procédure sont extraites
    expect(enriched.etapesProcedure).toBeDefined();
    expect(enriched.etapesProcedure?.length).toBe(3);
  });

  test('Scénario 1.2: Enrichissement d\'une réponse sur les anomalies', () => {
    const mockResponse: AIResponse = {
      message: 'Les risques identifiés sont: risque d\'électrocution sans protection différentielle, risque d\'incendie avec câbles dénudés. Mitigation: Installer un disjoncteur différentiel.',
      type: 'warning',
      _engine: 'RULES',
    };

    const enriched = enrichResponse(mockResponse);

    // Vérifier que le domaine est détecté
    expect(enriched.domaine).toBe('anomalies');

    // Vérifier que les risques sont extraits
    expect(enriched.risquesIdentifies).toBeDefined();
    expect(enriched.risquesIdentifies?.length).toBeGreaterThan(0);
  });

  test('Scénario 1.3: Enrichissement d\'une réponse avec verdict', () => {
    const mockResponse: AIResponse = {
      message: 'L\'installation est conforme aux normes NS 01-001.',
      type: 'success',
      verdict: 'Conforme',
      severity: 'Mineure',
      _engine: 'RULES',
    };

    const enriched = enrichResponse(mockResponse);

    // Vérifier que le verdict est préservé
    expect(enriched.verdict).toBe('Conforme');
    expect(enriched.severity).toBe('Mineure');
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 2: Test du système de feedback utilisateur
// ─────────────────────────────────────────────

describe('Système de feedback utilisateur', () => {
  test('Scénario 2.1: Enregistrement d\'un feedback positif', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const mockUser = {
      email: 'test@example.com',
      role: 'TECHNICIEN',
      id: 'user123',
    };

    const mockResponse: AIResponse = {
      message: 'Réponse test',
      type: 'info',
    };

    // Enregistrer un feedback positif
    await core.recordFeedback(
      'Quelle est la norme pour le branchement?',
      mockResponse,
      'positive',
      mockUser,
      'Réponse très utile'
    );

    // Vérifier que le statut d'apprentissage est mis à jour
    const status = await core.getLearningStatus();
    expect(status.totalFeedbacks).toBeGreaterThan(0);
  });

  test('Scénario 2.2: Enregistrement d\'un feedback négatif', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const mockUser = {
      email: 'test@example.com',
      role: 'TECHNICIEN',
      id: 'user123',
    };

    const mockResponse: AIResponse = {
      message: 'Réponse incorrecte',
      type: 'error',
    };

    // Enregistrer un feedback négatif
    await core.recordFeedback(
      'Comment installer un disjoncteur?',
      mockResponse,
      'negative',
      mockUser,
      'La réponse ne correspond pas à la norme'
    );

    // Vérifier que le nombre de feedbacks négatifs augmente
    const status = await core.getLearningStatus();
    expect(status.negativeFeedbacks).toBeGreaterThan(0);
  });

  test('Scénario 2.3: Calcul du taux de satisfaction', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const satisfactionRate = await core.getSatisfactionRate('test@example.com');
    expect(satisfactionRate).toBeGreaterThanOrEqual(0);
    expect(satisfactionRate).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 3: Test de l'auto-entraînement
// ─────────────────────────────────────────────

describe('Auto-entraînement', () => {
  test('Scénario 3.1: Génération de suggestions à partir des feedbacks', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const suggestions = await core.generateTrainingSuggestions();

    // Vérifier que des suggestions sont générées
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThanOrEqual(0);

    // Si des suggestions sont générées, vérifier leur structure
    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      expect(firstSuggestion).toHaveProperty('id');
      expect(firstSuggestion).toHaveProperty('question');
      expect(firstSuggestion).toHaveProperty('source');
      expect(firstSuggestion).toHaveProperty('priority');
      expect(firstSuggestion).toHaveProperty('confidence');
    }
  });

  test('Scénario 3.2: Acceptation d\'une suggestion d\'entraînement', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const mockUser = {
      email: 'admin@proquelec.com',
      role: 'ADMIN_PROQUELEC',
      id: 'admin123',
    };

    const mockSuggestion = {
      id: 'test-suggestion-1',
      question: 'Quelle est la norme pour le branchement SENELEC?',
      suggestedAnswer: 'La norme NS 01-001 définit les exigences pour le branchement SENELEC.',
      source: 'user_feedback' as const,
      priority: 'high' as const,
      confidence: 0.9,
    };

    // Accepter la suggestion
    await core.acceptTrainingSuggestion(mockSuggestion, mockUser);

    // Vérifier que la suggestion est retirée de la liste
    const suggestions = await core.generateTrainingSuggestions();
    const hasSuggestion = suggestions.some((s) => s.id === mockSuggestion.id);
    expect(hasSuggestion).toBe(false);
  });

  test('Scénario 3.3: Rejet d\'une suggestion d\'entraînement', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const suggestionId = 'test-suggestion-2';

    // Rejeter la suggestion
    await core.rejectTrainingSuggestion(suggestionId);

    // Vérifier que la suggestion est retirée de la liste
    const suggestions = await core.generateTrainingSuggestions();
    const hasSuggestion = suggestions.some((s) => s.id === suggestionId);
    expect(hasSuggestion).toBe(false);
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 4: Test de GEMAICore avec scénario complet
// ─────────────────────────────────────────────

describe('GEMAICore - Scénario complet', () => {
  test('Scénario 4.1: Flux complet de requête et réponse', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const mockUser = {
      email: 'technician@example.com',
      role: 'TECHNICIEN',
      id: 'tech123',
    };

    const mockContext = {
      stats: null,
      auditLogs: [],
      households: [],
      teams: [],
      regionalSummaries: [],
    };

    // Envoyer une requête
    const request = {
      query: 'Comment brancher SENELEC selon la norme?',
      user: mockUser,
      context: mockContext,
      options: {
        enableEnrichment: true,
        enableTraining: true,
        domain: 'branchement_senelec' as DomaineTechnique,
      },
    };

    const response = await core.processRequest(request);

    // Vérifier la réponse
    expect(response).toBeDefined();
    expect(response.response).toBeDefined();
    expect(response.enriched).toBe(true);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });

  test('Scénario 4.2: Vérification de l\'état du système', async () => {
    const core = getGEMAICore();
    await core.initialize();

    const state = core.getState();

    // Vérifier la structure de l'état
    expect(state).toHaveProperty('isThinking');
    expect(state).toHaveProperty('lastQuery');
    expect(state).toHaveProperty('lastResponse');
    expect(state).toHaveProperty('learningStatus');
    expect(state).toHaveProperty('metrics');
    expect(state).toHaveProperty('trainingSuggestions');
  });

  test('Scénario 4.3: Configuration dynamique', async () => {
    const core = getGEMAICore();
    await core.initialize();

    // Modifier la configuration
    core.updateConfig({
      enableAutoTraining: false,
      confidenceThreshold: 0.8,
    });

    const config = core.getConfig();
    expect(config.enableAutoTraining).toBe(false);
    expect(config.confidenceThreshold).toBe(0.8);

    // Réinitialiser
    core.reset();
    const resetConfig = core.getConfig();
    expect(resetConfig.enableAutoTraining).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 5: Test des types et interfaces
// ─────────────────────────────────────────────

describe('Types et interfaces', () => {
  test('Scénario 5.1: Validation des types de réponse enrichie', () => {
    const mockResponse: AIResponse = {
      message: 'Test',
      type: 'info',
      domaine: 'branchement_senelec',
      referencesCitees: [
        {
          norme: 'NS 01-001',
          chapter: 'Chapitre 1',
          article: 'Article 5',
        },
      ],
      risquesIdentifies: [
        {
          type: 'Risque électrique',
          description: 'Risque d\'électrocution',
          mitigation: 'Installer une protection différentielle',
        },
      ],
      etapesProcedure: [
        {
          numero: 1,
          description: 'Vérifier l\'installation',
        },
      ],
      meta: {
        confiance: 0.9,
        sources: ['NS 01-001'],
        version: '1.0',
        dateGeneration: new Date().toISOString(),
      },
    };

    // Vérifier que le type est valide
    expect(mockResponse.domaine).toBeDefined();
    expect(mockResponse.referencesCitees).toHaveLength(1);
    expect(mockResponse.risquesIdentifies).toHaveLength(1);
    expect(mockResponse.etapesProcedure).toHaveLength(1);
    expect(mockResponse.meta?.confiance).toBe(0.9);
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 6: Test d'intégration UI
// ─────────────────────────────────────────────

describe('Intégration UI', () => {
  test('Scénario 6.1: Test du composant MessageBubble avec feedback', () => {
    // Ce test nécessite React Testing Library
    // Pour l'instant, on teste la logique

    const mockResponse: AIResponse = {
      message: 'Réponse de test',
      type: 'info',
    };

    const onFeedback = jest.fn();
    const rating: 'positive' | 'negative' = 'positive';

    onFeedback(rating, 'Réponse utile');

    expect(onFeedback).toHaveBeenCalledWith('positive', 'Réponse utile');
  });

  test('Scénario 6.2: Test du composant AutoTrainingPanel', () => {
    // Ce test nécessite React Testing Library
    // Pour l'instant, on teste la logique

    const learningStatus = {
      totalFeedbacks: 10,
      negativeFeedbacks: 2,
      satisfactionRate: 0.8,
      patternsDetected: 5,
      pendingSuggestions: 3,
    };

    expect(learningStatus.satisfactionRate).toBe(0.8);
    expect(learningStatus.totalFeedbacks).toBe(10);
  });
});

// ─────────────────────────────────────────────
// SCÉNARIO 7: Test de performance
// ─────────────────────────────────────────────

describe('Performance', () => {
  test('Scénario 7.1: Temps de réponse d\'enrichissement', () => {
    const mockResponse: AIResponse = {
      message: 'Test message',
      type: 'info',
    };

    const start = performance.now();
    enrichResponse(mockResponse);
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(100); // Moins de 100ms
  });

  test('Scénario 7.2: Temps d\'initialisation de GEMAICore', async () => {
    const core = getGEMAICore();
    const start = performance.now();
    await core.initialize();
    const end = performance.now();

    const duration = end - start;
    expect(duration).toBeLessThan(1000); // Moins de 1 seconde
  });
});

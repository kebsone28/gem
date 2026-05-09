/**
 * ✅ Validateur de Qualité des Réponses IA
 * Vérifie la qualité, la cohérence et la pertinence des réponses avant envoi
 */

import type { AIResponse } from './MissionSageService';

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

interface QualityMetrics {
  length: number;
  hasStructure: boolean;
  hasReferences: boolean;
  hasActions: boolean;
  coherenceScore: number;
  relevanceScore: number;
  completenessScore: number;
}

class ResponseValidator {
  private minLength: number = 50;
  private maxLength: number = 5000;

  constructor(options?: { minLength?: number; maxLength?: number }) {
    if (options?.minLength) this.minLength = options.minLength;
    if (options?.maxLength) this.maxLength = options.maxLength;
  }

  /**
   * Valide une réponse complète
   */
  validate(response: AIResponse, originalQuery: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validation de base
    if (!response.message || response.message.trim().length === 0) {
      issues.push('La réponse est vide');
      return { isValid: false, score: 0, issues, warnings, suggestions };
    }

    // Vérification de la longueur
    const length = response.message.length;
    if (length < this.minLength) {
      warnings.push(`Réponse trop courte (${length} caractères, minimum ${this.minLength})`);
    }
    if (length > this.maxLength) {
      warnings.push(`Réponse très longue (${length} caractères)`);
    }

    // Vérification de la structure
    const hasStructure = this.checkStructure(response.message);
    if (!hasStructure) {
      suggestions.push('Ajouter une structure claire (étapes, listes)');
    }

    // Vérification des références
    const hasReferences = this.checkReferences(response.message);
    if (!hasReferences && this.isTechnicalQuery(originalQuery)) {
      suggestions.push('Citer les normes ou référentiels applicables');
    }

    // Vérification de la cohérence
    const coherenceScore = this.checkCoherence(response.message);
    if (coherenceScore < 0.5) {
      warnings.push('La réponse semble peu cohérente');
    }

    // Vérification de la pertinence
    const relevanceScore = this.checkRelevance(response.message, originalQuery);
    if (relevanceScore < 0.3) {
      issues.push('La réponse ne semble pas pertinente pour la question posée');
    }

    // Vérification des actions recommandées
    const hasActions = this.checkActions(response.message);
    if (!hasActions && this.isActionQuery(originalQuery)) {
      suggestions.push('Inclure des actions concrètes ou recommandations');
    }

    // Calcul du score global
    const score = this.calculateScore({
      length,
      hasStructure,
      hasReferences,
      hasActions,
      coherenceScore,
      relevanceScore,
      completenessScore: this.checkCompleteness(response.message),
    });

    return {
      isValid: issues.length === 0 && score > 0.3,
      score,
      issues,
      warnings,
      suggestions,
    };
  }

  /**
   * Vérifie si la réponse a une structure claire
   */
  private checkStructure(message: string): boolean {
    const structureIndicators = [
      /\d+\./, // Numérotations
      /[-•]\s/, // Listes
      /étape|step|phase/i, // Étapes
      /:\s*\n/, // Titres avec deux-points
    ];
    return structureIndicators.some((pattern) => pattern.test(message));
  }

  /**
   * Vérifie si la réponse contient des références
   */
  private checkReferences(message: string): boolean {
    const refIndicators = [
      /NS\s+\d{2}-\d{3}/i, // Normes NS
      /norme|standard|référentiel|guide/i,
      /article|chapitre|section/i,
      /KOBO|SENELEC|PROQUELEC/i,
    ];
    return refIndicators.some((pattern) => pattern.test(message));
  }

  /**
   * Vérifie la cohérence de la réponse
   */
  private checkCoherence(message: string): number {
    const sentences = message.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    // Vérifier la répétition excessive
    const words = message.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRate = uniqueWords.size / words.length;

    // Vérifier la présence de contradictions
    const contradictions = [
      /doit.*ne doit pas/i,
      /obligatoire.*facultatif/i,
      /oui.*non/i,
    ];
    const hasContradictions = contradictions.some((pattern) => pattern.test(message));

    let score = repetitionRate;
    if (hasContradictions) score -= 0.3;
    if (sentences.length < 2) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Vérifie la pertinence par rapport à la question
   */
  private checkRelevance(message: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const messageWords = message.toLowerCase().split(/\s+/);
    const messageWordsSet = new Set(messageWords);

    if (queryWords.length === 0) return 1;

    const matchedWords = queryWords.filter((word) => messageWordsSet.has(word));
    return matchedWords.length / queryWords.length;
  }

  /**
   * Vérifie si la réponse contient des actions
   */
  private checkActions(message: string): boolean {
    const actionIndicators = [
      /doit|doivent|dois/i,
      /vérifier|contrôler|inspecter/i,
      /installer|mettre en place/i,
      /respecter|suivre|appliquer/i,
      /action|mesure|précaution/i,
    ];
    return actionIndicators.some((pattern) => pattern.test(message));
  }

  /**
   * Vérifie la complétude de la réponse
   */
  private checkCompleteness(message: string): number {
    const completenessIndicators = [
      /conclusion|résumé|en résumé/i,
      /si.*sinon|dans le cas où/i,
      /attention|important|note/i,
      /exemple|par exemple|comme/i,
    ];

    const matched = completenessIndicators.filter((pattern) => pattern.test(message));
    return matched.length / completenessIndicators.length;
  }

  /**
   * Détermine si la requête est technique
   */
  private isTechnicalQuery(query: string): boolean {
    const technicalTerms = [
      'norme', 'installation', 'branchement', 'disjoncteur',
      'câble', 'tension', 'courant', 'protection',
      'SENELEC', 'NS 01', 'KOBO', 'ménage',
    ];
    return technicalTerms.some((term) => query.toLowerCase().includes(term));
  }

  /**
   * Détermine si la requête demande des actions
   */
  private isActionQuery(query: string): boolean {
    const actionTerms = [
      'comment', 'que faire', 'comment faire',
      'procédure', 'étape', 'marche à suivre',
      'installer', 'vérifier', 'contrôler',
    ];
    return actionTerms.some((term) => query.toLowerCase().includes(term));
  }

  /**
   * Calcule le score global de qualité
   */
  private calculateScore(metrics: QualityMetrics): number {
    const weights = {
      length: 0.1,
      structure: 0.15,
      references: 0.15,
      actions: 0.15,
      coherence: 0.2,
      relevance: 0.15,
      completeness: 0.1,
    };

    const lengthScore = metrics.length >= this.minLength && metrics.length <= this.maxLength ? 1 : 0.5;

    return (
      lengthScore * weights.length +
      (metrics.hasStructure ? 1 : 0) * weights.structure +
      (metrics.hasReferences ? 1 : 0) * weights.references +
      (metrics.hasActions ? 1 : 0) * weights.actions +
      metrics.coherenceScore * weights.coherence +
      metrics.relevanceScore * weights.relevance +
      metrics.completenessScore * weights.completeness
    );
  }

  /**
   * Suggère des améliorations pour une réponse
   */
  suggestImprovements(response: AIResponse, originalQuery: string): string[] {
    const validation = this.validate(response, originalQuery);
    return [...validation.issues, ...validation.warnings, ...validation.suggestions];
  }
}

// Singleton export
let validatorInstance: ResponseValidator | null = null;

export function getResponseValidator(options?: { minLength?: number; maxLength?: number }): ResponseValidator {
  if (!validatorInstance) {
    validatorInstance = new ResponseValidator(options);
  }
  return validatorInstance;
}

export function resetResponseValidator(): void {
  validatorInstance = null;
}

export type { ValidationResult, QualityMetrics };
export { ResponseValidator };

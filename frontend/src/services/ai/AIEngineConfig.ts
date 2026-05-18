 
/**
 * ⚙️ GED OS AI ENGINE (V2.0)
 * Gestionnaire de configuration des moteurs IA de GED OS
 * Réservé aux Administrateurs Système — Basculement entre moteurs en temps réel
 */

import logger from '../../utils/logger';

export type AIEngineMode = 'RULES_ONLY' | 'PRIVATE_AI_ONLY' | 'HYBRID_RULES_FIRST' | 'HYBRID_AI_FIRST';

export type AIProvider = 'CLAUDE_ANTHROPIC' | 'LOCAL_OLLAMA' | 'PUBLIC_POLLINATIONS';

export interface AIEngineSettings {
  mode: AIEngineMode;
  /** Fournisseur de l'IA (Ollama local, Claude, ou Public gratuit) */
  provider: AIProvider;
  /** Clé API si nécessaire (ex: Anthropic) */
  apiKey: string;
  
  // Nouveaux réglages unifiés (ex-GedOsAiCore)
  enableAutoTraining: boolean;
  enableResponseEnrichment: boolean;
  enableLearningMetrics: boolean;
  enableUserFeedback: boolean;
  maxTrainingSuggestions: number;
  confidenceThreshold: number;

  /** Conserver l'historique multi-tours dans le fallback */
  enableConversationMemory: boolean;
  /** Nombre max d'échanges gardés en mémoire de session */
  maxHistoryTurns: number;
  /** Timeout de l'appel IA en ms avant de basculer sur les règles */
  timeoutMs: number;
  /** Dernière modification et auteur */
  lastUpdatedBy?: string;
  lastUpdatedAt?: number;
}

const CONFIG_KEY = 'ged_os_ai_engine_config';

const DEFAULT_CONFIG: AIEngineSettings = {
  mode: 'HYBRID_AI_FIRST',
  provider: 'LOCAL_OLLAMA',
  apiKey: '',
  
  // Valeurs par défaut unifiées
  enableAutoTraining: true,
  enableResponseEnrichment: true,
  enableLearningMetrics: true,
  enableUserFeedback: true,
  maxTrainingSuggestions: 50,
  confidenceThreshold: 0.75,

  enableConversationMemory: true,
  maxHistoryTurns: 20,
  timeoutMs: 180000,
};

/** Charger la configuration active (avec valeurs par défaut) */
export function getAIEngineConfig(): AIEngineSettings {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIEngineSettings>;
      // Map old modes to new ones if necessary
      if ((parsed as any).mode === 'CLAUDE_ONLY') parsed.mode = 'PRIVATE_AI_ONLY';
      if ((parsed as any).provider === 'OLLAMA' || (parsed as any).provider === 'OLLAMA_LOCAL') {
        parsed.provider = 'LOCAL_OLLAMA';
      }
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    logger.warn('AIEngineConfig: lecture échouée, utilisation des défauts.', e);
  }
  return { ...DEFAULT_CONFIG };
}

/** Sauvegarder une nouvelle configuration (admin uniquement) */
export function saveAIEngineConfig(
  config: Partial<AIEngineSettings>,
  adminEmail: string
): AIEngineSettings {
  const current = getAIEngineConfig();
  const updated: AIEngineSettings = {
    ...current,
    ...config,
    lastUpdatedBy: adminEmail,
    lastUpdatedAt: Date.now(),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  logger.debug(`[AIEngine] Configuration mise à jour par ${adminEmail}:`, updated);
  return updated;
}

/** Réinitialiser aux valeurs par défaut */
export function resetAIEngineConfig(adminEmail: string): AIEngineSettings {
  return saveAIEngineConfig({ ...DEFAULT_CONFIG }, adminEmail);
}

/** Obtenir le libellé lisible d'un mode */
export function getModeLabelFR(mode: AIEngineMode): string {
  const labels: Record<AIEngineMode, string> = {
    RULES_ONLY: 'Règles statiques uniquement',
    PRIVATE_AI_ONLY: 'Moteur IA Privé uniquement',
    HYBRID_RULES_FIRST: 'Hybride — Expert Local en priorité',
    HYBRID_AI_FIRST: 'Hybride — IA Privée en priorité',
  };
  return labels[mode] ?? mode;
}

/** Obtenir la description détaillée d'un mode */
export function getModeDescriptionFR(mode: AIEngineMode): string {
  const desc: Record<AIEngineMode, string> = {
    RULES_ONLY:
      'Le moteur de règles gère 100% des réponses (Zéro latence). Aucun appel au serveur IA. Idéal pour les zones à très faible connexion.',
    PRIVATE_AI_ONLY:
      'Votre IA locale Ollama répond à toutes les questions. Exploite toute la puissance de votre VPS privé.',
    HYBRID_RULES_FIRST:
      'Les règles métier (Le Coran de l’Électricien) répondent en priorité. L’IA Ollama prend le relai si la question dépasse le référentiel.',
    HYBRID_AI_FIRST:
      "L'IA Privée analyse chaque demande en priorité. Si elle est surchargée, les règles statiques assurent la continuité de service.",
  };
  return desc[mode] ?? '';
}

/** Indicateur : L'IA est-elle active dans ce mode ? */
export function isAIEnabled(config: AIEngineSettings): boolean {
  return config.mode !== 'RULES_ONLY';
}

/** Indicateur : Les règles sont-elles actives dans ce mode ? */
export function isRulesEnabled(config: AIEngineSettings): boolean {
  return config.mode !== 'PRIVATE_AI_ONLY';
}

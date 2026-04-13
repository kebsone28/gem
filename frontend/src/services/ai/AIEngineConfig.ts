/**
 * ⚙️ AI ENGINE CONFIG SERVICE (V1.0)
 * Gestionnaire de configuration des moteurs IA de GEM-MINT
 * Réservé à l'Admin PROQUELEC — Basculement entre moteurs en temps réel
 */

export type AIEngineMode = 'RULES_ONLY' | 'CLAUDE_ONLY' | 'HYBRID_RULES_FIRST' | 'HYBRID_AI_FIRST';

export type AIProvider = 'CLAUDE_ANTHROPIC' | 'LOCAL_OLLAMA' | 'PUBLIC_POLLINATIONS';

export interface AIEngineSettings {
  mode: AIEngineMode;
  /** Fournisseur de l'IA (Claude, Ollama local, ou Public gratuit) */
  provider: AIProvider;
  /** Clé API Anthropic pour le moteur Claude AI */
  claudeApiKey: string;
  /** Activer Claude AI sur les questions techniques (en plus du référentiel) */
  claudeEnrichTechnical: boolean;
  /** Activer Claude AI sur les analyses DG/décision */
  claudeEnrichDecision: boolean;
  /** Conserver l'historique multi-tours dans le fallback Claude */
  enableConversationMemory: boolean;
  /** Nombre max d'échanges gardés en mémoire de session */
  maxHistoryTurns: number;
  /** Timeout de l'appel Claude en ms avant de basculer sur les règles */
  claudeTimeoutMs: number;
  /** Dernière modification et auteur */
  lastUpdatedBy?: string;
  lastUpdatedAt?: number;
}

const CONFIG_KEY = 'gem_mint_ai_engine_config';

const DEFAULT_CONFIG: AIEngineSettings = {
  mode: 'HYBRID_RULES_FIRST', // Optimisé pour la vitesse et la couverture
  provider: 'PUBLIC_POLLINATIONS', // Test AI public
  claudeApiKey: '',
  claudeEnrichTechnical: true, // Amélioré pour plus de précision technique
  claudeEnrichDecision: true,
  enableConversationMemory: true,
  maxHistoryTurns: 15, // Augmenté pour meilleure mémoire contextuelle
  claudeTimeoutMs: 5000, // Réduit pour meilleure réactivité
};

/** Charger la configuration active (avec valeurs par défaut) */
export function getAIEngineConfig(): AIEngineSettings {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIEngineSettings>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('AIEngineConfig: lecture échouée, utilisation des défauts.', e);
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
  console.info(`[AIEngine] Configuration mise à jour par ${adminEmail}:`, updated);
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
    CLAUDE_ONLY: 'Claude AI uniquement',
    HYBRID_RULES_FIRST: 'Hybride — Règles en priorité (recommandé)',
    HYBRID_AI_FIRST: 'Hybride — Claude AI en priorité',
  };
  return labels[mode] ?? mode;
}

/** Obtenir la description détaillée d'un mode */
export function getModeDescriptionFR(mode: AIEngineMode): string {
  const desc: Record<AIEngineMode, string> = {
    RULES_ONLY:
      'Le moteur de règles intègre 100% des réponses. Aucun appel API. Mode hors-ligne recommandé pour les zones à faible connectivité.',
    CLAUDE_ONLY:
      'Claude AI répond à toutes les questions. Nécessite une connexion active et consomme le quota API. Privilégier pour les sessions DG/stratégiques.',
    HYBRID_RULES_FIRST:
      'Les règles métier répondent en priorité (rapide, sans latence). Claude AI prend le relai uniquement si la question dépasse le référentiel. Mode recommandé.',
    HYBRID_AI_FIRST:
      "Claude AI répond en priorité à chaque question. Si l'API est indisponible ou dépasse le timeout, les règles prennent le relai automatiquement.",
  };
  return desc[mode] ?? '';
}

/** Indicateur : Claude AI est-il actif dans ce mode ? */
export function isClaudeEnabled(config: AIEngineSettings): boolean {
  return config.mode !== 'RULES_ONLY';
}

/** Indicateur : Les règles sont-elles actives dans ce mode ? */
export function isRulesEnabled(config: AIEngineSettings): boolean {
  return config.mode !== 'CLAUDE_ONLY';
}

/**
 * SERVICE : MissionSageService (V.8.0 DUAL-ENGINE SUPREME)
 * GEM-MINT - Cerveau Global PROQUELEC
 */

import type { User, AuditLog, Household } from '../../utils/types';
import type { MissionStats } from '../missionStatsService';
import { db } from '../../store/db';
import { getTechnicalAnswer } from './ElectricianQuran';
import { analyzeDG, computeIGPPScore } from './DecisionEngine';
import { getAIEngineConfig, type AIEngineSettings } from './AIEngineConfig';
import { buildPublicAIKnowledgePrompt } from './AIKnowledgeBase';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface AIState {
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
}

export interface AIResponse {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'user';
  actionLabel?: string;
  actionPath?: string;
  actionType?: 'nav' | 'download_report' | 'download_contract';
  images?: { url: string; caption: string }[];
  smartReplies?: string[];
  /** 🆕 Indique quel moteur a produit cette réponse (visible en mode admin debug) */
  _engine?: 'RULES' | 'CLAUDE' | 'RULES_FALLBACK' | 'CLAUDE_FALLBACK' | 'VISION' | 'VISION_ERROR';
}

interface SessionMemory {
  lastIntent?: string;
  lastEntities?: string[];
  lastMetricsViewed?: string[];
  decisionHistory?: string[];
  history: string[];
  contextHistory: { role: 'user' | 'assistant'; content: string }[];
  lastUpdated: number;
}

// ─────────────────────────────────────────────
// MÉMOIRE SESSION
// ─────────────────────────────────────────────

const MEMORY_KEY = 'gem_mint_memory_';

function getMemory(userId: string): SessionMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY + userId);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionMemory;
      if (Date.now() - parsed.lastUpdated < 3600000) {
        return { ...parsed, contextHistory: parsed.contextHistory || [] };
      }
    }
  } catch (e) {}
  return { history: [], contextHistory: [], lastUpdated: Date.now() };
}

function saveMemory(userId: string, mem: SessionMemory) {
  mem.lastUpdated = Date.now();
  const maxTurns = getAIEngineConfig().maxHistoryTurns * 2;
  if (mem.contextHistory.length > maxTurns)
    mem.contextHistory = mem.contextHistory.slice(-maxTurns);
  if (mem.history.length > 50) mem.history = mem.history.slice(-50);
  localStorage.setItem(MEMORY_KEY + userId, JSON.stringify(mem));
}

// ─────────────────────────────────────────────
// UTILITAIRES COMMUNS
// ─────────────────────────────────────────────

function normalizeWord(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function fuzzyContains(query: string, keywords: string[], maxErrors = 2): boolean {
  const words = query.split(/\s+/);
  for (const w of words) {
    if (w.length < 5) continue;
    for (const k of keywords) {
      if (Math.abs(w.length - k.length) <= maxErrors) {
        let matrix: number[][] = [];
        for (let i = 0; i <= k.length; i++) matrix[i] = [i];
        for (let j = 0; j <= w.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= k.length; i++) {
          for (let j = 1; j <= w.length; j++) {
            matrix[i][j] =
              k.charAt(i - 1) === w.charAt(j - 1)
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
          }
        }
        if (matrix[k.length][w.length] <= maxErrors) return true;
      }
    }
  }
  return false;
}

const QUESTION_CATALOG: Record<string, string[]> = {
  mission: [
    'Comment créer une mission ?',
    'Qui valide les OM ?',
    'Comment certifier une mission ?',
    'Voir mes missions',
    'Comment suivre l’état d’une mission ?',
    'Quelle est la durée moyenne de validation ?',
    'Comment corriger une mission rejetée ?',
    'Comment annuler une mission ?',
  ],
  finance: [
    'Audit financier global',
    'Indemnités de mission',
    'Budget certifié',
    'Comment calculer les coûts de branchement ?',
    'Que faire en cas de dépassement budgétaire ?',
    'Comment optimiser les indemnités ?',
    'Quel est le seuil d’alerte budgétaire ?',
    'Comment suivre les dépenses terrain ?',
  ],
  kobo: [
    'Règles terrain MFR',
    'Synchronisation Kobo',
    'Ménages raccordés',
    'Que faire si Kobo ne remonte pas ?',
    'Comment corriger une erreur Kobo ?',
    'Comment valider un formulaire Kobo ?',
    'Quels champs Kobo sont obligatoires ?',
    'Comment lier Kobo à GEM-MINT ?',
  ],
  norme: [
    'Norme NS 01-001',
    'Domaine d’application de la norme',
    'Exclusions de la norme NS 01-001',
    'Comment respecter la norme ?',
    'Quelles installations sont couvertes ?',
    'Quelle tension est permise ?',
    'Quelles sont les exclusions sanitaires ?',
    'Comment assurer conformité BT ?',
  ],
  senelec: [
    'Branchement Senelec',
    'Hauteur du câble Senelec',
    'Protection mécanique PVC',
    'Limite de propriété pour le coffret comptoir',
    'Hauteur du hublot du coffret',
    'Comment éviter le surplomb ?',
    'Où installer le potelet ?',
    'Quelle hauteur pour les traversées routières ?',
  ],
  compteur: [
    'Pose du compteur',
    'Règles disjoncteur',
    'Schéma de branchement',
    'Comment positionner l’interrupteur ?',
    'Comment choisir un disjoncteur ?',
    'Où fixer le coffret compteur ?',
    'Comment tester la prise de terre ?',
    'Quelle section de câble choisir ?',
  ],
  protection: [
    'Contact direct',
    'Contact indirect',
    'DDR',
    'Parafoudre',
    'Fusible',
    'Comment protéger contre les surtensions ?',
    'Comment éviter les chocs électriques ?',
    'Quelle est la différence DDR/fusible ?',
  ],
  anomalies: [
    'Anomalies à éviter',
    'Fils visibles',
    'Câbles extérieurs',
    'Barrette de terre externe',
    'Poteau bois pourri',
    'Pourquoi le cable visible est interdit ?',
    'Quels sont les défauts fréquents ?',
    'Comment signaler une anomalie ?',
  ],
  interieur: [
    'Installation intérieure MFR',
    'Coffret disjoncteur couvert',
    'Configuration standard 3 lampes/1 prise',
    'Câble armé enterré',
    'Interrupteur en zone couverte',
    'Où placer le coffret intérieur ?',
    'Comment protéger un couloir ?',
    'Comment installer un hublot étanche ?',
  ],
  glossaire: [
    'Partie active',
    'Masse électrique',
    'Liaison équipotentielle',
    'Conducteur PE',
    'Section nominale',
    'Qu’est-ce qu’un contact direct ?',
    'Qu’est-ce qu’un contact indirect ?',
    'Pourquoi le PE est vert/jaune ?',
  ],
  termes: [
    'Définition partie active',
    'Définition masse électrique',
    'Définition liaison équipotentielle',
    'C’est quoi un DDR ?',
    'C’est quoi une prise de terre ?',
    'Quelle est la section nominale ?',
    'Pourquoi le DDR est indispensable ?',
    'Quand utiliser une liaison équipotentielle ?',
  ],
  specs: [
    'Hauteur minimale des câbles',
    'Profondité d’enfouissement du câble armé',
    'Nombre de lampes et prises standard',
    'Normes de protection mécanique',
    'Spécifications du coffret en limite propriété',
    'Distance de sécurité autour du compteur',
    'Comment respecter le grillage avertisseur ?',
    'Quel matériel utiliser pour un MFR ?',
  ],
  decision: [
    'Risque de retard DG',
    'Recommandations IGPP',
    'Analyse stratégique DG',
    'Que signifie un score IGPP bas ?',
    'Quels indicateurs améliorer ?',
    'Comment réduire les risques de stagnation ?',
  ],
  report: [
    'Générer un rapport Word',
    'Exporter un rapport PDF',
    'Contenu du rapport stratégique',
    'Comment partager un rapport ?',
    'Quelles sections contient le rapport ?',
  ],
};

const QUESTION_GENERATORS: Record<
  string,
  {
    subjects: string[];
    verbs: string[];
    templates: string[];
  }
> = {
  mission: {
    subjects: ['mission', 'OM', 'ordre de mission'],
    verbs: [
      'créer',
      'valider',
      'certifier',
      'corriger',
      'annuler',
      'modifier',
      'suivre',
      'clôturer',
    ],
    templates: [
      'Comment {verb} une {subject} ?',
      'Quelles étapes pour {verb} une {subject} ?',
      'Quels sont les critères pour {verb} une {subject} ?',
      'Pourquoi une {subject} peut être rejetée ?',
      'Comment savoir si une {subject} est prête pour la DG ?',
      'Que faire si une {subject} est bloquée ?',
      'Comment améliorer la performance d’une {subject} ?',
    ],
  },
  finance: {
    subjects: ['budget', 'indemnité', 'coût', 'dépense', 'provision', 'montant'],
    verbs: ['calculer', 'optimiser', 'suivre', 'contrôler', 'prévoir', 'réduire'],
    templates: [
      'Comment {verb} le {subject} ?',
      'Quelle est la méthode pour {verb} le {subject} ?',
      'Quels sont les risques si le {subject} est dépassé ?',
      'Comment analyser le {subject} ?',
      'Comment réduire les {subject}s ?',
      'Comment planifier le {subject} ?',
    ],
  },
  kobo: {
    subjects: ['Kobo', 'terrain', 'audit terrain', 'formulaire Kobo', 'collecte'],
    verbs: ['synchroniser', 'corriger', 'valider', 'suivre', 'résoudre', 'déployer'],
    templates: [
      'Comment {verb} les données {subject} ?',
      'Que faire si {subject} ne se synchronise pas ?',
      'Comment corriger une erreur dans {subject} ?',
      'Quels champs sont obligatoires dans {subject} ?',
      'Comment améliorer la collecte {subject} ?',
    ],
  },
  norme: {
    subjects: ['Norme NS 01-001', 'norme', 'standard', 'règle'],
    verbs: ['respecter', 'comprendre', 'appliquer', 'vérifier', 'contrôler'],
    templates: [
      'Comment {verb} la {subject} ?',
      'Quelles installations couvre la {subject} ?',
      'Comment savoir si on est conforme à la {subject} ?',
      'Quelles sont les exclusions de la {subject} ?',
      'Quels risques si on ne respecte pas la {subject} ?',
    ],
  },
  senelec: {
    subjects: ['Senelec', 'branchement', 'potelet', 'coffret compteur', 'câble de branchement'],
    verbs: ['installer', 'protéger', 'vérifier', 'positionner', 'raccorder'],
    templates: [
      'Comment {verb} un {subject} ?',
      'Quelles sont les règles pour un {subject} ?',
      'Où installer le {subject} ?',
      'Comment assurer la sécurité du {subject} ?',
      'Quels documents pour un {subject} ?',
    ],
  },
  compteur: {
    subjects: ['compteur', 'disjoncteur', 'tableau électrique', 'interrupteur'],
    verbs: ['poser', 'choisir', 'installer', 'tester', 'protéger'],
    templates: [
      'Comment {verb} un {subject} ?',
      'Quels sont les critères pour choisir un {subject} ?',
      'Comment tester un {subject} ?',
      'Où placer le {subject} ?',
      'Quelles protections pour un {subject} ?',
    ],
  },
  protection: {
    subjects: ['protection', 'DDR', 'parafoudre', 'fusible', 'sécurité'],
    verbs: ['installer', 'vérifier', 'comprendre', 'mettre en place', 'contrôler'],
    templates: [
      'Comment {verb} la {subject} ?',
      'Pourquoi installer un {subject} ?',
      'Quels sont les avantages du {subject} ?',
      'Comment choisir un {subject} ?',
      'Comment prévenir une {subject} défaillante ?',
    ],
  },
  anomalies: {
    subjects: [
      'anomalie',
      'défaut',
      'fils visibles',
      'câbles extérieurs',
      'barrette de terre externe',
    ],
    verbs: ['éviter', 'détecter', 'corriger', 'signaler', 'prévenir'],
    templates: [
      'Comment {verb} une {subject} ?',
      'Pourquoi une {subject} est-elle dangereuse ?',
      'Quels sont les signes d’une {subject} ?',
      'Comment corriger une {subject} ?',
      'Que faire en cas de {subject} ?',
    ],
  },
  interieur: {
    subjects: [
      'installation intérieure',
      'coffret disjoncteur',
      'prise',
      'lampe',
      'grillage avertisseur',
    ],
    verbs: ['positionner', 'installer', 'protéger', 'vérifier', 'configurer'],
    templates: [
      'Comment {verb} une {subject} ?',
      'Où placer une {subject} ?',
      'Quelles sont les règles pour une {subject} ?',
      'Comment assurer la conformité d’une {subject} ?',
      'Quels matériels pour une {subject} ?',
    ],
  },
  glossaire: {
    subjects: [
      'partie active',
      'masse électrique',
      'liaison équipotentielle',
      'conducteur PE',
      'section nominale',
    ],
    verbs: ['définir', 'comprendre', 'expliquer', 'identifier', 'assurer'],
    templates: [
      'Qu’est-ce qu’une {subject} ?',
      'Comment {verb} une {subject} ?',
      'Quelle est la différence entre une {subject} et un autre terme ?',
      'Pourquoi la {subject} est-elle importante ?',
      'Quels sont les risques liés à une mauvaise {subject} ?',
    ],
  },
};

function generateQuestionVariants(category: string, limit = 1000): string[] {
  const definition = QUESTION_GENERATORS[category];
  if (!definition) return [];

  const variants = new Set<string>();

  for (const subject of definition.subjects) {
    for (const verb of definition.verbs) {
      for (const template of definition.templates) {
        if (variants.size >= limit) break;
        variants.add(
          template.replace('{subject}', subject).replace('{verb}', verb).replace(/\s+/g, ' ').trim()
        );
      }
      if (variants.size >= limit) break;
    }
    if (variants.size >= limit) break;
  }

  return Array.from(variants).slice(0, limit);
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mission: ['mission', 'om', 'ordre', 'certif', 'soumi', 'valid', 'annul', 'rejete'],
  finance: ['budget', 'argent', 'indemnité', 'compta', 'fcfa', 'coût', 'dépense', 'depassement'],
  kobo: [
    'kobo',
    'terrain',
    'audit',
    'collect',
    'saisie',
    'menage',
    'formulaire',
    'sync',
    'remonte',
  ],
  norme: ['norme', 'ns 01-001', 'bt', 'erp', 'habitation', 'tension', 'conformité', 'regle'],
  senelec: [
    'senelec',
    'branchement',
    'potelet',
    'tube',
    'pvc',
    'hublot',
    'surplomber',
    'limite propriete',
  ],
  compteur: [
    'compteur',
    'disjoncteur',
    'schéma',
    'pose',
    'interrupteur',
    'tableau',
    'installation',
  ],
  protection: [
    'protection',
    'ddr',
    'parafoudre',
    'surtension',
    'surintensité',
    'fusible',
    'sécurité',
    'choc',
  ],
  anomalies: [
    'anomalie',
    'erreur',
    'defaut',
    'interdit',
    'fils',
    'cables',
    'barrette',
    'poteau',
    'visible',
    'extérieur',
  ],
  interieur: [
    'intérieur',
    'interieur',
    'coffret',
    'couloir',
    'prise',
    'lampe',
    'câble armé',
    'enterré',
    'étanche',
    'grillage',
  ],
  glossaire: [
    'glossaire',
    'définition',
    'terme',
    'masse',
    'partie active',
    'équipotentielle',
    'conducteur pe',
    'section',
    'prise de terre',
  ],
  termes: [
    'partie active',
    'masse',
    'liaison équipotentielle',
    'ddr',
    'prise terre',
    'section nominale',
  ],
  specs: [
    'hauteur',
    'profondeur',
    'configuration',
    'grillage',
    'spécification',
    'norme',
    'matériel',
    'coffret',
  ],
  decision: [
    'decision',
    'analyse',
    'strategie',
    'rapport',
    'igpp',
    'bilan',
    'performance',
    'risque',
  ],
  report: ['rapport', 'export', 'word', 'pdf', 'générer', 'télécharger', 'compte rendu'],
};

function getSmartSuggestions(q: string): string[] {
  const suggestions = getQuestionSuggestions(q);
  if (suggestions.length > 0) return suggestions.slice(0, 4);

  return [
    'Rapport stratégique DG',
    'Cahier de Charge (Modèle)',
    'Aide Technique Vision',
    'Missions en attente',
    'Norme NS 01-001',
  ];
}

const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  mission: 'Missions',
  finance: 'Finance',
  kobo: 'Terrain / Kobo',
  norme: 'Norme NS 01-001',
  senelec: 'Branchement Senelec',
  compteur: 'Compteur / Disjoncteur',
  protection: 'Protection électrique',
  anomalies: 'Anomalies & défauts',
  interieur: 'Installation intérieure',
  glossaire: 'Glossaire technique',
  termes: 'Définitions clés',
  specs: 'Spécifications',
  decision: 'Analyse DG',
  report: 'Rapports',
};

function isKeywordSearch(query: string): boolean {
  const normalized = normalizeWord(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  const hasQuestionWord =
    /\b(qui|quoi|ou|où|quand|comment|pourquoi|estce|cest|que|quel|quelle|quelles|quelques)\b/.test(
      normalized
    );
  return words.length <= 4 && !hasQuestionWord;
}

function getMatchedCategories(query: string): string[] {
  const normalized = normalizeWord(query);
  const matched: string[] = [];

  for (const [category, keys] of Object.entries(CATEGORY_KEYWORDS)) {
    if (
      keys.some((key) => {
        const normalizedKey = normalizeWord(key);
        return normalized.includes(normalizedKey) || fuzzyContains(normalized, [normalizedKey], 1);
      })
    ) {
      matched.push(category);
    }
  }

  return Array.from(new Set(matched));
}

function getQuestionSuggestions(query: string): string[] {
  const normalized = normalizeWord(query);
  const suggestions = new Set<string>();
  const categoryScores: Record<string, number> = {};

  for (const [category, keys] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const key of keys) {
      const normalizedKey = normalizeWord(key);
      if (normalized.includes(normalizedKey)) score += 3;
      else if (fuzzyContains(normalized, [normalizedKey], 1)) score += 1;
    }

    if (score > 0) {
      categoryScores[category] = score;
      const generated = generateQuestionVariants(category, 1000);
      [...(QUESTION_CATALOG[category] || []), ...generated].forEach((question) =>
        suggestions.add(question)
      );
    }
  }

  if (suggestions.size === 0) {
    // Ne pas ajouter de questions par défaut si aucune catégorie ne correspond
    // Cela évite de suggérer des questions non pertinentes pour des mots-clés arbitraires
  }

  const orderedCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  const orderedSuggestions: string[] = [];
  for (const category of orderedCategories) {
    const generated = generateQuestionVariants(category, 1000);
    for (const question of [...(QUESTION_CATALOG[category] || []), ...generated]) {
      if (!orderedSuggestions.includes(question)) orderedSuggestions.push(question);
      if (orderedSuggestions.length >= 10) break;
    }
    if (orderedSuggestions.length >= 10) break;
  }

  if (orderedSuggestions.length > 0) return orderedSuggestions;

  return Array.from(suggestions).slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ MOTEUR 1 : RÈGLES STATIQUES RENFORCÉES (V8.0)
// ═══════════════════════════════════════════════════════════════

function detectIntent(q: string) {
  return {
    greeting: /salam|bonjour|hello|hi|salut|bonsoir|hey|wesh|yo|as-salam|assalam/.test(q),
    global:
      /explique|plateforme|logiciel|systeme|comment|cest quoi|fonction|quoi sert|kesako|c quoi|decrire/.test(
        q
      ),
    kobo: /kobo|terrain|collect|sync|menage|point|donnee viennent|formulaire|audit terrain|saisie/.test(
      q
    ),
    mission: /mission|\bom\b|ordre|certifi|soumi|creer mission|nouvelle mission|mes om|lancer/.test(
      q
    ),
    workflow: /valide|circuit|qui fait quoi|qui valide|processus|etapes|parcours validation/.test(
      q
    ),
    finance:
      /argent|budget|montant|indemnite|finance|compta|prix|paye|cout|fcfa|depense|tresorerie/.test(
        q
      ),
    dashboard: /stats|igpp|chiffre|performance|indicateur|kpi|tableau de bord|tdb/.test(q),
    security: /role|acces|droit|admin|securite|permis|bloque|interdit|autoris|habilitat/.test(q),
    sync: /remonte|sync|real time|force sync|actualise|recharge|rafraich|mise a jour/.test(q),
    org: /dg|chef|agent|technicien|organisation|equipe|hierarchie|qui est|responsable/.test(q),
    forbidden: /modif|chang|suppr|triche|edit|interdit|effac|annul|retour arriere/.test(q),
    vague: /aide|comprends pas|faire quoi|complique|perdu|confus|expliquer|aide moi|stp/.test(q),
    fast: /^(mission|budget|kobo|stats|aide|bonjour|salam|hi|hello)$/.test(q),
    tech:
      /compteur|disjoncteur|transform|branchement|norme|spec|37500|faible revenu|eligibilit|interieur|senelec|ns 01-001|protection|anomalie|cable|choc electrique|fusible|conducteur|mise a la terre|ppe|ddp|ddr/.test(
        q
      ) ||
      fuzzyContains(q, [
        'compteur',
        'disjoncteur',
        'branchement',
        'anomalie',
        'senelec',
        'conducteur',
      ]),
    geo: /region|zone|ou|dakar|saint-louis|podor|pikine|tivaouane|kaolack|thies|louga|matam|diourbel|fatick|ziguinchor|tambacounda/.test(
      q
    ),
    audit: /qui|fait quoi|activite|action|log|historique|derniere|trace|journal|mouvement/.test(q),
    household: /menage|famille|maison|habitant|foyer|beneficiaire|client|concession/.test(q),
    rights: /droit|acces|permission|pouvoir|autorise|faire quoi|mon role|mes droits|capacite/.test(
      q
    ),
    simulation: /devis|simul|calculer|prix branchement|estimation|cout previsionnel|chiffrage/.test(
      q
    ),
    inventory:
      /stock|materiel|inventaire|logistique|flux|equipement|cable en stock|compteur disponible/.test(
        q
      ),
    diagnostic:
      /sante|erreur|bug|diagnostic|etat systeme|latence|lent|plante|crash|probleme technique/.test(
        q
      ),
    mapping: /champs|kobo mapping|correspondance|donnee kobo|champ form|lien kobo/.test(q),
    decision: /decision|analyse|strategie|etat global|rapport dg|bilan|synthese|vue ensemble/.test(
      q
    ),
    menu: /menu|aide|liste|question|aidez-moi|guide|quoi faire|que peux-tu|capacites/.test(q),
    approbation: /approuver|valider mission|signature dg|sceau|certifier|signer|approbation/.test(
      q
    ),
    performance: /igpp|score|taux|avancement|objectif|cible|pourcentage|progression/.test(q),
    planning: /planif|calendrier|semaine|mois|programme|agenda|delai|echeance/.test(q),
    report: /rapport|compte rendu|cr|export|telecharger|generer rapport|word|pdf/.test(q),
    help_create: /comment creer|comment faire|etapes pour|procedure|tutoriel|demarche/.test(q),
    // Nouveaux intents basés sur ElectricianQuran
    mfr: /mfr|menage faible revenu|eligibilite|critere selection|faible revenu|projet mfr/.test(q),
    norme: /ns 01-001|norme|regle generale|domaine application|tension|bt|erp|habitation/.test(q),
    protection:
      /protection|choc electrique|contact direct|contact indirect|surintensite|surtension|ddr|fusible|parafoudre/.test(
        q
      ),
    anomalies:
      /anomalie|eviter|mauvais|erreur|defaut|interdit|mauvaise pratique|visible|fils|cables exterieurs|barrette terre/.test(
        q
      ),
    branchement:
      /branchement|senelec|limite propriete|potelet|pvc|tube|hublot|hauteur|surplomber|grillage/.test(
        q
      ),
    interieur:
      /interieur|installation interieure|coffret disjoncteur|couloir|couvert|prise|lampe|interrupteur|cable arme|enterr/.test(
        q
      ),
    glossaire:
      /glossaire|definition|terme|masse|partie active|contact|equipotentielle|prise terre|conducteur pe|section/.test(
        q
      ),
    // Extensions pour 20 questions supplémentaires
    terms:
      /partie active|masse electrique|contact indirect|liaison equipotentielle|ddr role|prise terre|couleur pe|section nominale/.test(
        q
      ),
    specs:
      /hauteur minimale|configuration standard|protection mecanique|hublot hauteur|cables plein air|barrette terre exterieur|poteaux bois|surplomber/.test(
        q
      ),
    protection_details: /eviter contact indirect|parafoudre|surtensions|fusible|surintensites/.test(
      q
    ),
    anomalies_details:
      /fils visibles|cutteur|pince|enterrer cables|grillage rouge|bois pourris|limite propriete/.test(
        q
      ),
    contract: /contrat|cahier des charge|clause|caution|engagement|assurance|garantie|📜/.test(q),
  };
}

function getContextualIntent(memory: SessionMemory, currentIntent: any) {
  const hasIntent = Object.values(currentIntent).some((v) => v === true);
  if (!hasIntent && memory.lastIntent && currentIntent.hasOwnProperty(memory.lastIntent)) {
    return { ...currentIntent, [memory.lastIntent]: true };
  }
  return currentIntent;
}

function getActiveIntents(intent: any): string[] {
  return Object.entries(intent)
    .filter(([_, v]) => v === true)
    .map(([k]) => k);
}

function buildContextualEnrichment(
  intent: any,
  stats: MissionStats | null,
  households: Household[] = []
): string {
  if (!stats) return '';
  const parts: string[] = [];

  if (intent.finance && stats.totalIndemnities > 5000000)
    parts.push(
      '⚠️ **CONSEIL STRATÉGIQUE** : Dérive budgétaire détectée — seuils critiques proches.'
    );

  if ((intent.mission || intent.performance) && stats.totalMissions > 0) {
    const certRate = Math.round((stats.totalCertified / stats.totalMissions) * 100);
    if (certRate < 50)
      parts.push(
        `📊 **CONSEIL PRÉDICTIF** : Taux de certification à ${certRate}% — accélérez les validations DG.`
      );
    else if (certRate >= 80)
      parts.push(
        `✅ **PERFORMANCE** : Taux de certification excellent (${certRate}%) — bastion en zone verte.`
      );
  }

  if (intent.household && households && households.length > 0) {
    const done = households.filter(
      (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
    ).length;
    const pct = Math.round((done / households.length) * 100);
    if (pct < 30)
      parts.push(`🏘️ **TERRAIN** : Avancement à ${pct}% — accélérez les raccordements.`);
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : '';
}

const KNOWLEDGE = {
  global:
    'PROQUELEC est votre bastion SaaS de gestion énergétique. Il repose sur 4 piliers stratégiques : 🏗️ Terrain (Kobo), 📋 Logistique (Missions), 📊 Pilotage (Dashboard) et 💰 Finance (Contrôle).',
  kobo: 'Le Pilier n°1 (Kobo) capte les audits et ménages directement sur le terrain. Les données remontent vers votre Dashboard pour une vision analytique pure.',
  mission:
    "Une mission (OM) est votre unité d'action. Elle passe par 3 étapes : création par l'Agent, validation par le Chef, et certification finale par la DG.",
  workflow:
    'Le circuit de validation respecte la hiérarchie : Agent crée → Chef valide → DG certifie.',
  finance:
    "Le Pilier Finance calcule les indemnités et surveille le budget. L'IGPP alerte avant tout dépassement.",
  dashboard: "Le Dashboard est votre tour de contrôle. L'IGPP 3.0 mesure la performance globale.",
  security:
    "Chaque collaborateur a un rôle défini (RBAC). Si une action est bloquée, c'est pour protéger l'intégrité du système.",
  sync: "La synchronisation s'effectue automatiquement avec une connexion 4G/Wifi.",
  org: 'La DG décide, le Chef coordonne, les Agents exécutent. Ensemble, ils forment le bastion.',
  forbidden:
    'Modifier ou supprimer des données certifiées est interdit pour garantir la traçabilité.',
  simulation: 'Le module [Simulation] génère des devis de branchement avant le terrain.',
  inventory: 'Le module [Logistique] surveille votre stock : compteurs, câbles, disjoncteurs.',
  diagnostic: 'Le module [Diagnostic Santé] surveille la latence et les erreurs système.',
  mapping: "Le [Kobo Mapping Master] garantit l'alignement entre Kobo et votre base de données.",
  approbation: 'Le module [Approbation DG] est le tribunal de la Direction Générale.',
  // Nouveaux basés sur ElectricianQuran
  mfr: "Le projet MFR cible les ménages à faible revenu. Critères : proximité Senelec, revenu faible, propriété exclusive, construction en dur, pas d'installation pré-existante.",
  norme:
    "La norme NS 01-001 s'applique aux installations BT ≤1000V AC/1500V DC. Cible : habitations, ERP, commerces. Exclusions : locaux médicaux, mines, HT.",
  protection:
    'Protection contre chocs : contacts directs (isolement), indirects (coupure auto via DDR), surintensités (fusibles), surtensions (parafoudres).',
  anomalies:
    "Anomalies majeures : fils visibles, câbles extérieurs, barrette terre à l'extérieur, poteaux bois pourris. Utilisez cutteur, pas pince.",
  branchement:
    'Branchement Senelec : coffret en limite propriété, câble non surplombeur, hublot à 1.60m, hauteur ≥4m ruelles/6m routes, protection PVC.',
  interieur:
    'Installation intérieure : coffret couloir couvert, interrupteurs couverts, config standard 3 lampes/1 prise, câbles armés enterrés 0.5m sous grillage rouge.',
  glossaire:
    'Glossaire NS 01-001 : Partie active (sous tension), Masse (conductrice touchable), Contact direct/indirect, Liaison équipotentielle, DDR (coupure fuite), PE (vert/jaune), Section (ex: 1.5mm²).',
  vision:
    "👁️ **L'OEIL DU MENTOR** : Utilisez l'icône Caméra pour scanner une installation. L'IA détecte les anomalies techniques et propose des corrections selon la norme NS 01-001.",
  certification:
    "🛡️ **CERTIFICATION QR** : Tous les rapports Word (OM/DG) incluent un QR Code d'authenticité. Scannez-le pour vérifier la validité du document sur le bastion.",
  decision:
    '🧠 **DÉCISION DG** : Le score IGPP 3.0 mesure la performance. Un score < 60 nécessite une revue stratégique immédiate via le rapport Word IA.',
  // Extensions pour 20 questions supplémentaires
  terms:
    'Définitions clés : Partie active (conducteur sous tension), Masse (pièce touchable pouvant être sous tension), Contact indirect (via défaut sur masse), Liaison équipotentielle (connexion pour annuler potentiels), DDR (coupure fuite terre), Prise terre (contact permanent sol), PE (vert/jaune), Section nominale (surface câble ex: 1.5mm²).',
  specs:
    'Spécifications : Hauteur câble ≥4m ruelles/6m routes, Configuration intérieure 3 lampes/1 prise, Protection PVC obligatoire, Hublot à 1.60m, Câbles enterrés 0.5m sous grillage rouge, Limite propriété pour coffret.',
  protection_details:
    'Détails protection : Éviter contact indirect par coupure DDR, Parafoudre contre surtensions atmosphériques, Fusible contre surintensités, DDR pour fuites terre.',
  anomalies_details:
    'Anomalies spécifiques : Fils visibles (utiliser cutteur pas pince), Câbles plein air (interdit), Barrette terre extérieur (interdit), Poteaux bois pourris (interdit), Surplomber maisons (interdit).',
};

const HELP_CREATE: Record<string, string> = {
  mission:
    '**Comment créer une mission (OM) :**\n1️⃣ Allez dans **Missions** → Nouvelle Mission\n2️⃣ Renseignez titre, zone, date et agents\n3️⃣ Soumettez pour validation au Chef\n4️⃣ Après validation Chef → la DG peut certifier.',
  kobo: '**Comment saisir des données Kobo :**\n1️⃣ Ouvrez Kobo Collect sur votre mobile\n2️⃣ Remplissez le formulaire (ménage, photos, GPS)\n3️⃣ Soumettez — remonte automatiquement en 4G/Wifi.',
  audit:
    "**Comment réaliser un audit visuel :**\n1️⃣ Cliquez sur l'icône **Caméra** dans le chat\n2️⃣ Prenez une photo de l'installation (compteur, câbles)\n3️⃣ Le Mentor analyse les anomalies et vous guide.",
  report:
    "**Comment générer un rapport certifié :**\n1️⃣ Allez dans **Approbation DG**\n2️⃣ Cliquez sur **Générer Rapport Word**\n3️⃣ Le document inclut le QR Code et l'analyse stratégique IA.",
};

async function runRulesEngine(
  query: string,
  user: any,
  state: AIState,
  memory: SessionMemory
): Promise<AIResponse | null> {
  const { stats, households, auditLogs } = state;
  const q = normalizeWord(query);

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'noble acteur';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase();

  const isMaster = user.role === 'ADMIN_PROQUELEC' || user.email === 'admingem';
  const isDG = ['DG_PROQUELEC', 'DIRECTEUR', 'COMPTABLE', 'ADMIN_PROQUELEC'].includes(user.role);

  const DYNAMIC_GREETINGS = [
    `As-Salam Alaykum ${formattedName} 🌙`,
    `As-Salam Alaykum noble ${formattedName}, pilier du bastion PROQUELEC 🏗️`,
    `Que la Baraka et la Sagesse guident vos pas ${formattedName} ✨`,
  ];

  let greeting = '';
  if (memory.history.length <= 2) {
    greeting = DYNAMIC_GREETINGS[Math.floor(Math.random() * DYNAMIC_GREETINGS.length)];
    if (isDG || isMaster) greeting = `🏛️ **CONSEILLER DG** : ${greeting}`;
    else if (user.role === 'CHEF_PROJET') greeting = `📋 **SYNTHÈSE CHEF DE PROJET** : ${greeting}`;
    else greeting = `⚡ **ASSISTANT TECHNIQUE** : ${greeting}`;
  }

  const pfx = (txt: string) => (greeting ? `${greeting}\n\n${txt}` : txt);
  const relatedQuestions = getQuestionSuggestions(query);

  const techAnswer = getTechnicalAnswer(q);
  if (techAnswer) {
    memory.lastIntent = 'tech';
    return {
      message: pfx(techAnswer.message),
      type: 'info',
      images: techAnswer.images,
      smartReplies:
        relatedQuestions.length > 0
          ? relatedQuestions
          : ['Comment assurer la sécurité ?', 'Règles Senelec', 'Anomalies à éviter'],
      _engine: 'RULES',
    };
  }

  let intent = detectIntent(q);
  intent = getContextualIntent(memory, intent);
  const activeIntents = getActiveIntents(intent);

  if (intent.greeting) {
    return {
      message: pfx("Comment puis-je vous aider aujourd'hui ?"),
      type: 'success',
      smartReplies: [
        '📋 Mes missions',
        '💰 Budget',
        '🏘️ Terrain Kobo',
        '📏 Normes',
        '📊 Dashboard',
      ],
      _engine: 'RULES',
    };
  }

  if (isKeywordSearch(query) && relatedQuestions.length > 0) {
    const matchedCategories = getMatchedCategories(query).map(
      (cat) => CATEGORY_DISPLAY_NAME[cat] || cat
    );
    const categoryText =
      matchedCategories.length > 0
        ? `Domaine(s) détecté(s) : ${matchedCategories.join(', ')}.`
        : '';

    return {
      message: pfx(
        `${categoryText}\n\nLe mot-clé "${query}" correspond à plusieurs questions que je peux traiter :\n\n${relatedQuestions
          .map((item, index) => `${index + 1}. ${item}`)
          .join('\n')}`
      ),
      type: 'info',
      smartReplies: relatedQuestions,
      _engine: 'RULES',
    };
  }
  if (intent.finance && !isDG && !isMaster) {
    return {
      message: pfx(
        `Ces données confidentielles sont protégées pour votre rôle (**${user.role}**).`
      ),
      type: 'warning',
      smartReplies: ['Voir mes missions', 'Retour'],
      _engine: 'RULES',
    };
  }

  if (intent.help_create) {
    if (intent.mission) {
      return {
        message: pfx(HELP_CREATE.mission),
        type: 'info',
        actionLabel: 'Nouvelle Mission',
        actionPath: '/mission-order',
        _engine: 'RULES',
      };
    }
    if (intent.kobo) {
      return {
        message: pfx(HELP_CREATE.kobo),
        type: 'info',
        actionLabel: 'Ouvrir Kobo',
        actionPath: '/kobo',
        _engine: 'RULES',
      };
    }
  }

  if (intent.report && (isDG || isMaster)) {
    return {
      message: pfx(
        '📄 **GÉNÉRATION DE RAPPORT**\n\nSouhaitez-vous télécharger le rapport stratégique Word complet ?'
      ),
      type: 'info',
      actionLabel: 'Télécharger Word',
      actionType: 'download_report',
      _engine: 'RULES',
    };
  }

  if (intent.performance && stats) {
    const igpp = computeIGPPScore(stats, households);
    return {
      message: pfx(
        `📊 **SCORE IGPP : ${igpp}/100**\n\nMissions certifiées : ${stats.totalCertified}/${stats.totalMissions}`
      ),
      type: igpp >= 60 ? 'success' : 'warning',
      actionLabel: 'Voir Dashboard',
      actionPath: '/admin',
      _engine: 'RULES',
    };
  }

  if (activeIntents.length > 1) {
    const responses: string[] = [];
    if (intent.mission && stats) {
      responses.push(
        `📋 **Missions** : ${stats.totalMissions} (${stats.totalCertified} certifiées).`
      );
    }
    if (intent.finance && stats) {
      responses.push(
        `💰 **Budget** : ${new Intl.NumberFormat('fr-FR').format(stats.totalIndemnities)} FCFA.`
      );
    }
    if (intent.tech) {
      responses.push(`⚡ **Technique** : Référentiel Senelec/NS 01-001 prêt.`);
    }
    if (responses.length > 1) {
      return {
        message: pfx(`Vue combinée :\n\n${responses.join('\n')}`),
        type: 'success',
        _engine: 'RULES',
      };
    }
  }

  if (intent.global) {
    return {
      message: pfx(KNOWLEDGE.global),
      type: 'info',
      actionLabel: 'Dashboard',
      actionPath: '/admin',
      _engine: 'RULES',
    };
  }
  if (intent.kobo) {
    memory.lastIntent = 'kobo';
    return { message: pfx(KNOWLEDGE.kobo), type: 'info', _engine: 'RULES' };
  }
  if (intent.mission) {
    memory.lastIntent = 'mission';
    const enrich = buildContextualEnrichment(intent, stats, households);
    return {
      message: pfx(
        KNOWLEDGE.mission + (stats ? ` (${stats.totalMissions} missions)` : '') + enrich
      ),
      type: 'info',
      actionLabel: 'Mes Missions',
      actionPath: '/mission-order',
      _engine: 'RULES',
    };
  }
  if (intent.workflow) {
    return { message: pfx(KNOWLEDGE.workflow), type: 'info', _engine: 'RULES' };
  }
  if (intent.decision && (isMaster || isDG)) {
    const insights = analyzeDG(stats, households, auditLogs);
    if (insights.length === 0) {
      return {
        message: pfx('Tout est sous contrôle dans le bastion.'),
        type: 'success',
        _engine: 'RULES',
      };
    }
    const formatted = insights.map((i) => `• ${i.message}`).join('\n\n');
    return {
      message: pfx(`🏛️ **BILAN DG**\n\n${formatted}`),
      type: 'warning',
      actionLabel: 'Rapport Word',
      actionType: 'download_report',
      _engine: 'RULES',
    };
  }
  if (intent.contract || q.includes('cahier char')) {
    return {
      message: pfx(
        "📄 **CAHIER DES CHARGES / CONTRAT**\n\nSouhaitez-vous générer le modèle de contrat d'exécution incluant les clauses de 'Caution d'Assurance' et les audits Vision IA ?"
      ),
      type: 'info',
      actionLabel: 'Générer Contrat',
      actionType: 'download_contract',
      _engine: 'RULES',
    };
  }
  if (intent.menu) {
    return {
      message: pfx('Voici ce que je peux faire :'),
      type: 'info',
      smartReplies: [
        '📜 Contrat',
        '📋 Missions',
        '💰 Finance',
        '🏘️ Terrain',
        '📏 Normes',
        '📊 Dashboard',
      ],
      _engine: 'RULES',
    };
  }

  // Nouveaux cas pour ElectricianQuran
  if (intent.mfr) {
    return {
      message: pfx(KNOWLEDGE.mfr),
      type: 'info',
      smartReplies: ['Critères éligibilité', 'Installation intérieure', 'Branchement Senelec'],
      _engine: 'RULES',
    };
  }
  if (intent.norme) {
    return {
      message: pfx(KNOWLEDGE.norme),
      type: 'info',
      smartReplies: ['Domaine application', 'Protection', 'Glossaire'],
      _engine: 'RULES',
    };
  }
  if (intent.protection) {
    return {
      message: pfx(KNOWLEDGE.protection),
      type: 'info',
      smartReplies: ['Contact direct', 'DDR', 'Parafoudre'],
      _engine: 'RULES',
    };
  }
  if (intent.anomalies)
    return {
      message: pfx(KNOWLEDGE.anomalies),
      type: 'info',
      smartReplies: ['Fils visibles', 'Câbles extérieurs', 'Poteaux bois'],
      _engine: 'RULES',
    };
  if (intent.branchement) {
    return {
      message: pfx(KNOWLEDGE.branchement),
      type: 'info',
      smartReplies: ['Limite propriété', 'Hauteur câble', 'Protection PVC'],
      _engine: 'RULES',
    };
  }
  if (intent.interieur) {
    return {
      message: pfx(KNOWLEDGE.interieur),
      type: 'info',
      smartReplies: ['Coffret disjoncteur', 'Câbles armés', 'Grillage rouge'],
      _engine: 'RULES',
    };
  }
  if (intent.glossaire) {
    return {
      message: pfx(KNOWLEDGE.glossaire),
      type: 'info',
      smartReplies: ['Partie active', 'Conducteur PE', 'Section'],
      _engine: 'RULES',
    };
  }

  // Extensions pour 20 questions supplémentaires
  if (intent.terms) {
    return {
      message: pfx(KNOWLEDGE.terms),
      type: 'info',
      smartReplies: ['Partie active', 'Masse électrique', 'Contact indirect'],
      _engine: 'RULES',
    };
  }
  if (intent.specs) {
    return {
      message: pfx(KNOWLEDGE.specs),
      type: 'info',
      smartReplies: ['Hauteur minimale', 'Configuration standard', 'Protection mécanique'],
      _engine: 'RULES',
    };
  }
  if (intent.protection_details) {
    return {
      message: pfx(KNOWLEDGE.protection_details),
      type: 'info',
      smartReplies: ['Éviter contact indirect', 'Parafoudre', 'Fusible'],
      _engine: 'RULES',
    };
  }
  if (intent.anomalies_details) {
    return {
      message: pfx(KNOWLEDGE.anomalies_details),
      type: 'info',
      smartReplies: ['Fils visibles', 'Câbles plein air', 'Poteaux bois'],
      _engine: 'RULES',
    };
  }

  // 10. MAPPING GÉNÉRIQUE DES INTENTIONS SUR LE KNOWLEDGE (FALLBACK)
  for (const intentKey of activeIntents) {
    if (KNOWLEDGE.hasOwnProperty(intentKey)) {
      memory.lastIntent = intentKey;
      let msg = KNOWLEDGE[intentKey as keyof typeof KNOWLEDGE];
      if (intentKey === 'mission' && stats) msg += ` (${stats.totalMissions} missions)`;

      const enrich = buildContextualEnrichment(intent, stats, households);

      return {
        message: pfx(msg + enrich),
        type: 'info',
        smartReplies: getSmartSuggestions(query),
        _engine: 'RULES',
      };
    }
  }

  // 10. MAPPING GÉNÉRIQUE DES INTENTIONS SUR LE KNOWLEDGE (FALLBACK)
  for (const intentKey of activeIntents) {
    if (KNOWLEDGE.hasOwnProperty(intentKey)) {
      memory.lastIntent = intentKey;
      let msg = KNOWLEDGE[intentKey as keyof typeof KNOWLEDGE];
      if (intentKey === 'mission' && stats) msg += ` (${stats.totalMissions} missions)`;
      const enrich = buildContextualEnrichment(intent, stats, households);
      return {
        message: pfx(msg + enrich),
        type: 'info',
        smartReplies: getSmartSuggestions(query),
        _engine: 'RULES',
      };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// 🤖 MOTEUR 2 : CLAUDE AI (V2.0)
// ═══════════════════════════════════════════════════════════════

async function callOllamaAI(query: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3',
        prompt: query,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Ollama non détecté sur localhost:11434');
    const data = await response.json();
    return data.response;
  } catch (e: any) {
    throw new Error('Ollama unreachable. Install it from ollama.com');
  } finally {
    clearTimeout(timer);
  }
}

async function callVisionAI(
  query: string,
  base64Image: string,
  user?: any,
  state?: AIState
): Promise<AIResponse> {
  const visionPrompt = `
Tu es l'Oeil du Mentor GEM-MINT. Analyse cette image d'installation électrique PROQUELEC.
INSTRUCTION: Détecte les anomalies techniques (fils nus, absence PVC, poteau bois, etc.).
CONTEXTE: ${user?.role || 'Technicien'} ${user?.displayName || ''}. 
STATS: Missions=${state?.stats?.totalMissions || 0}.

SI TU VOIS UNE ANOMALIE:
1. Décris-la précisément (ex: "Câble 2.5mm² sans gaine PVC").
2. Donne la règle Senelec/NS 01-001 correspondante.
3. Propose une action corrective.

IMAGE ANALYSIS REQUEST: ${query || 'Analyse visuelle de cette installation.'}
`;

  try {
    // Nettoyer le base64 pour l'URL si besoin, mais Pollinations attend souvent une URL ou un format spécifique.
    // Pour text.pollinations.ai, on peut parfois passer des descriptions d'images,
    // mais pour une vraie vision, on utilise gen.pollinations.ai ou un proxy.
    // Ici, on simule l'appel vision via Pollinations (qui supporte la description d'image par prompt enrichi ou multimodal)
    const response = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(visionPrompt)}?model=openai&image=${encodeURIComponent(base64Image)}`
    );
    if (!response.ok) throw new Error('Service Vision indisponible.');
    const text = await response.text();

    return {
      message: `👁️ **ANALYSE VISUELLE DU MENTOR**\n\n${text}`,
      type: 'warning',
      images: [{ url: base64Image, caption: 'Scan Oculaire GEM-MINT' }],
      _engine: 'VISION',
    };
  } catch (e: any) {
    return {
      message: "L'analyse visuelle a échoué. Veuillez vérifier la qualité de l'image.",
      type: 'error',
      _engine: 'VISION_ERROR',
    };
  }
}

async function callPublicFreeAI(query: string, user?: any, state?: AIState): Promise<string> {
  const contextPrompt = buildPublicAIKnowledgePrompt(query, user, state);

  const response = await fetch(
    `https://text.pollinations.ai/${encodeURIComponent(contextPrompt)}?model=openai`
  );
  if (!response.ok) throw new Error('Service public Pollinations indisponible.');
  return await response.text();
}

async function callClaudeAI(
  query: string,
  user: any,
  state: AIState,
  history: any[],
  timeout: number
): Promise<string> {
  const config = getAIEngineConfig();

  if (config.provider === 'LOCAL_OLLAMA') {
    return await callOllamaAI(query, timeout);
  }

  if (config.provider === 'PUBLIC_POLLINATIONS') {
    return await callPublicFreeAI(query, user, state);
  }

  if (!config.claudeApiKey) {
    return "⚠️ Le moteur Claude AI n'est pas configuré. Veuillez contacter l'Admin PROQUELEC pour renseigner la clé API.";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const isDG = ['DG_PROQUELEC', 'DIRECTEUR', 'COMPTABLE', 'ADMIN_PROQUELEC'].includes(user.role);
    const statsCtx = state.stats
      ? `• Missions totales : ${state.stats.totalMissions}\n• Missions certifiées : ${state.stats.totalCertified}\n• Budget indemnités : ${new Intl.NumberFormat('fr-FR').format(state.stats.totalIndemnities)} FCFA`
      : 'Statistiques non disponibles.';

    const systemPrompt = `Tu es GEM-MINT, l'assistant IA expert de PROQUELEC.
## CONTEXTE UTILISATEUR: Nom=${user.displayName || user.name}, Rôle=${user.role}
## DONNÉES TEMPS RÉEL:
${statsCtx}
• Ménages terrain : ${(state.households || []).length}
## DIRECTIVES: Réponds en français, précis, technique (Norme NS 01-001) ou stratégique. ${!isDG ? 'Refuser poliment les demandes financières confidentielles.' : ''}`;

    const messages = [
      ...(history || []).slice(-(config.maxHistoryTurns || 10)),
      { role: 'user', content: query },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // Required if calling from browser directly
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erreur API Claude');
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (err: any) {
    clearTimeout(timer);
    console.error('[Claude_AI] Call failed:', err);
    if (err.name === 'AbortError')
      return '⏳ Le moteur Claude AI a mis trop de temps à répondre (Timeout).';
    throw err;
  }
}

async function runClaudeEngine(
  query: string,
  user: any,
  state: AIState,
  memory: SessionMemory,
  settings: AIEngineSettings
): Promise<AIResponse> {
  // Gestion du forçage mode règles (via Smart Reply)
  if (query.includes('Utiliser les règles uniquement')) {
    const res = await runRulesEngine('aide', user, state, memory);
    return {
      ...(res || { message: 'Basculement sur le moteur métier local.', type: 'info' }),
      message:
        '🔄 **Basculement local** : ' +
        (res?.message || 'Je reste à votre service via mon référentiel interne.'),
      _engine: 'RULES',
    };
  }

  try {
    const ans = await callClaudeAI(
      query,
      user,
      state,
      memory.contextHistory,
      settings.claudeTimeoutMs
    );
    return {
      message: ans,
      type: 'info',
      smartReplies: getSmartSuggestions(query),
      _engine: 'CLAUDE',
    };
  } catch (err: any) {
    console.error('[Claude_Engine] Managed error:', err);

    let userMsg = `❌ **Erreur Claude AI** : ${err.message || 'Impossible de joindre le moteur IA'}.`;

    // Raffinement des messages d'erreur connus
    if (err.message?.includes('credit balance')) {
      userMsg = `💳 **Solde Anthropic Insuffisant** : Votre compte Claude AI n'a plus de crédits. Veuillez recharger votre solde sur le portail Anthropic Console.`;
    } else if (err.message?.includes('API key')) {
      userMsg = `🔑 **Clé API Invalide** : La clé configurée est rejetée par Anthropic. Vérifiez la clé dans le panneau Admin.`;
    }

    return {
      message: `${userMsg}\n\n*Note : Le bastion continue de fonctionner en mode local (Règles métiers).*`,
      type: 'error',
      smartReplies: ['Utiliser les règles uniquement', 'Réessayer'],
      _engine: 'CLAUDE_FALLBACK',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎛️ ORCHESTRATEUR
// ═══════════════════════════════════════════════════════════════

async function orchestrate(
  query: string,
  user: any,
  state: AIState,
  memory: SessionMemory
): Promise<AIResponse> {
  const config = getAIEngineConfig();
  const userId = user.email || user.id || 'anonymous';

  if (config.mode === 'RULES_ONLY') {
    const res = await runRulesEngine(query, user, state, memory);
    if (res) return res;
    // Audit failure
    try {
      await db.ai_learning_logs.add({
        query,
        userId,
        role: user.role,
        timestamp: new Date(),
        context: 'rules_fallback',
      });
    } catch (e) {}
  }

  if (config.mode === 'HYBRID_RULES_FIRST') {
    const res = await runRulesEngine(query, user, state, memory);
    if (res) return res;
    return await runClaudeEngine(query, user, state, memory, config);
  }

  if (config.mode === 'CLAUDE_ONLY') {
    return await runClaudeEngine(query, user, state, memory, config);
  }

  // Fallback
  const fallback = await runRulesEngine(query, user, state, memory);
  if (fallback) return fallback;
  return { message: 'Question hors référentiel. Reformulez.', type: 'info', _engine: 'RULES' };
}

export const missionSageService = {
  async processQuery(
    query: string,
    user: any,
    state: AIState,
    image?: string // Base64 image
  ): Promise<AIResponse> {
    const userId = user.email || user.id || 'anonymous';
    const memory = getMemory(userId);
    memory.history.push(image ? `[IMAGE] ${query}` : query);

    let response: AIResponse;

    if (image) {
      // Direct pass to Vision AI if image is provided
      response = await callVisionAI(query, image, user, state);
    } else {
      response = await orchestrate(query, user, state, memory);
    }

    const config = getAIEngineConfig();
    if (config.enableConversationMemory) {
      memory.contextHistory.push({ role: 'user', content: query });
      memory.contextHistory.push({ role: 'assistant', content: response.message });
    }
    saveMemory(userId, memory);
    return response;
  },

  async getProactiveMessage(user: User, state: AIState): Promise<AIResponse | null> {
    const { stats } = state;
    if (!stats) return null;
    const isDG = ['DG_PROQUELEC', 'DIRECTEUR', 'COMPTABLE'].includes(user.role);
    if (isDG && stats.totalIndemnities > 5000000)
      return {
        message: 'Alerte Budget : Les indemnités dépassent 5M FCFA.',
        type: 'warning',
        actionLabel: 'Auditer',
        actionPath: '/admin',
      };
    return null;
  },
};

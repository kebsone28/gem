import {
  ELECTRICIAN_GUIDE,
  KOBO_STANDARDS,
  getTechnicalAnswer,
  type TechnicalDefinition,
} from './ElectricianQuran.ts';
import { generateKnowledgeQuestions } from './AIKnowledgeBase.ts';

type ExpertVerdict = 'Conforme' | 'Conforme sous réserve' | 'Non conforme' | 'A verifier';
type ExpertSeverity = 'critique' | 'majeure' | 'mineure' | 'information';

export interface DeepAuditQuestion {
  id: string;
  domain: string;
  question: string;
  expectedAnchors: string[];
  expectedReferences: string[];
  expectedForbiddenPractices?: string[];
  expectedAction?: string;
  expectedVerdict?: ExpertVerdict;
  expectedSeverity?: ExpertSeverity;
  smartReplies?: string[];
  referenceAnswer: string;
  allowAutomaticOverride: boolean;
}

export interface AnswerEvaluation {
  totalScore: number;
  coverageScore: number;
  referenceScore: number;
  structureScore: number;
  verdictScore: number;
  severityScore: number;
  actionScore: number;
  repetitionPenalty: number;
  matchedAnchors: string[];
  missingAnchors: string[];
  missingReferences: string[];
  issues: string[];
}

export interface DeepAuditComparison {
  question: DeepAuditQuestion;
  aiAnswer: string;
  referenceAnswer: string;
  aiEvaluation: AnswerEvaluation;
  referenceEvaluation: AnswerEvaluation;
  preferredAnswer: 'ai' | 'reference';
}

export interface GeneratedMissionSageOverride {
  question: string;
  domain: string;
  message: string;
  smartReplies?: string[];
  verdict?: ExpertVerdict;
  severity?: ExpertSeverity;
  recommendedAction?: string;
  referenceScore: number;
  aiScore: number;
}

interface OperationalReferenceEntry {
  title: string;
  summary: string;
  meaning: string;
  anchors: string[];
  references: string[];
  smartReplies: string[];
  actionLine?: string;
  keywords: string[];
  templates: string[];
}

const STOP_WORDS = new Set([
  'avec',
  'apres',
  'après',
  'ainsi',
  'alors',
  'assez',
  'autres',
  'avant',
  'car',
  'cela',
  'celle',
  'celui',
  'cependant',
  'chaque',
  'comment',
  'comme',
  'dans',
  'depuis',
  'des',
  'donc',
  'elle',
  'elles',
  'entre',
  'etre',
  'être',
  'faire',
  'faut',
  'leur',
  'leurs',
  'mais',
  'meme',
  'même',
  'moins',
  'nous',
  'pour',
  'pourquoi',
  'plus',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'sans',
  'sera',
  'sont',
  'sous',
  'sur',
  'tous',
  'tout',
  'toute',
  'toutes',
  'tres',
  'très',
  'une',
  'vous',
  'votre',
  'vos',
]);

const OPERATIONAL_REFERENTIAL: Record<string, OperationalReferenceEntry> = {
  global: {
    title: 'GEM-MINT',
    summary:
      "GEM-MINT centralise le terrain, les missions, le pilotage et le contrôle financier dans une même chaîne de vérité.",
    meaning:
      "L'objectif n'est pas d'empiler des modules. Le système doit garder la cohérence entre ce qui est collecté sur le terrain, ce qui est validé et ce qui est indemnisé.",
    anchors: [
      'Le terrain est collecté via Kobo avec GPS, photos et statuts.',
      'Les missions structurent le travail, la validation et la traçabilité.',
      'Le dashboard consolide KPIs, retards et lecture régionale.',
      'Le contrôle financier relie budget, indemnités et écarts.',
    ],
    references: ['MISSION_SAGE_INTEGRATION_README', 'AIKnowledgeBase GEM-MINT'],
    smartReplies: ['Mes missions', 'Terrain Kobo', 'Dashboard', 'Budget'],
    actionLine:
      'La bonne décision consiste toujours à rapprocher le terrain, le statut mission et le niveau de validation avant de conclure.',
    keywords: ['gem', 'gem mint', 'proquelec', 'plateforme', 'systeme', 'système'],
    templates: [
      'Quel est le rôle global de GEM-MINT dans PROQUELEC ?',
      'Comment GEM-MINT relie-t-il le terrain, la mission et la finance ?',
      'Quelle est la logique métier générale de la plateforme GEM-MINT ?',
      'Pourquoi GEM-MINT doit-il garder une seule chaîne de vérité ?',
      'Comment expliquer GEM-MINT à un responsable opérationnel ?',
    ],
  },
  mission: {
    title: 'Ordres de mission',
    summary:
      'Une mission est l’unité de travail tracée qui relie le besoin terrain, les validations hiérarchiques et l’impact financier.',
    meaning:
      "Une mission bien cadrée protège la suite du flux. Une mission floue coûte plus cher à corriger au moment du contrôle et de la certification.",
    anchors: [
      'La mission décrit l’objectif, la zone, la date et les équipes concernées.',
      'La soumission prépare le contrôle par le chef de projet.',
      'La certification valide officiellement l’exécution.',
      'Chaque étape doit laisser une preuve exploitable.',
    ],
    references: ['MISSION_SAGE_INTEGRATION_README', 'Workflow OM interne'],
    smartReplies: ['Comment créer une mission ?', 'Qui valide les OM ?', 'Voir mes missions', 'Comment certifier une mission ?'],
    actionLine:
      'Avant soumission, vérifier le cadrage, les pièces justificatives et le statut réel de la mission.',
    keywords: ['mission', 'om', 'ordre mission', 'ordre de mission', 'certifier', 'valider'],
    templates: [
      'Comment créer une mission OM proprement ?',
      'Quelles sont les étapes d’une mission dans GEM-MINT ?',
      'Qui contrôle puis certifie une mission ?',
      'Comment corriger une mission rejetée ?',
      'Quels éléments rendent une mission prête pour la certification ?',
    ],
  },
  workflow: {
    title: 'Circuit de validation',
    summary:
      'Le workflow protège la qualité de décision en imposant qui agit, dans quel ordre et avec quel niveau de preuve.',
    meaning:
      "Un workflow utile évite les validations trop rapides, les responsabilités floues et les décisions impossibles à auditer après coup.",
    anchors: [
      'Le terrain est renseigné par les agents ou techniciens.',
      'Le chef de projet contrôle la cohérence opérationnelle et budgétaire.',
      'La direction valide ce qui engage officiellement le projet.',
      'Les transitions de statut doivent rester traçables.',
    ],
    references: ['Workflow OM interne', 'MISSION_SAGE_INTEGRATION_README'],
    smartReplies: ['Qui valide les OM ?', 'Comment corriger une mission rejetée ?', 'Historique des actions', 'Rapport stratégique DG'],
    actionLine:
      'Avant chaque transition, vérifier le bon rôle, le bon statut et la présence des justificatifs.',
    keywords: ['workflow', 'validation', 'validation mission', 'circuit', 'approbation'],
    templates: [
      'Comment fonctionne le circuit de validation des missions ?',
      'Quel est le rôle du chef de projet dans la validation ?',
      'Quand la direction intervient-elle dans le workflow ?',
      'Pourquoi une transition de statut peut-elle être bloquée ?',
      'Comment sécuriser un workflow mission avant certification ?',
    ],
  },
  finance: {
    title: 'Contrôle financier',
    summary:
      'Le module finance consolide les coûts, les indemnités et les écarts pour garder le projet pilotable.',
    meaning:
      "Une lecture financière saine sert à arbitrer tôt. Elle ne doit pas être séparée des volumes terrain, des retards et des reprises d'ouvrage.",
    anchors: [
      'Les indemnités dépendent des missions certifiées et des règles autorisées.',
      'Le budget doit être lu avec les volumes réels de terrain.',
      'Les écarts doivent être rapprochés du matériel, de la logistique et des reprises.',
      'Un seuil d’alerte demande une revue de pilotage avant dérapage complet.',
    ],
    references: ['AIKnowledgeBase GEM-MINT', 'Bilan financier prévisionnel interne'],
    smartReplies: ['Audit financier global', 'Indemnités de mission', 'Budget certifié', 'Que faire en cas de dépassement budgétaire ?'],
    actionLine:
      'Avant toute conclusion budgétaire, rapprocher les coûts certifiés, les volumes terrain et les anomalies de reprise.',
    keywords: ['finance', 'budget', 'indemnite', 'indemnité', 'cout', 'coût'],
    templates: [
      'Comment contrôler les indemnités dans GEM-MINT ?',
      'Que faire en cas de dépassement budgétaire ?',
      'Comment lire correctement le budget d’un projet terrain ?',
      'Quels sont les signaux d’alerte d’un dérive financière ?',
      'Comment rapprocher budget, missions et terrain ?',
    ],
  },
  dashboard: {
    title: 'Pilotage et KPIs',
    summary:
      'Le dashboard transforme les données terrain et mission en décisions exploitables au bon moment.',
    meaning:
      "Un bon KPI ne décrit pas seulement un état. Il indique où agir, avec quelle priorité et sur quel périmètre.",
    anchors: [
      'Le taux de certification mesure la fluidité réelle du flux mission.',
      'Les retards régionaux révèlent les goulots opérationnels.',
      'Les anomalies répétées distinguent incident ponctuel et dérive de méthode.',
      'Le dashboard doit rester lisible pour l’action, pas seulement pour la consultation.',
    ],
    references: ['MISSION_SAGE_INTEGRATION_README', 'AIKnowledgeBase GEM-MINT'],
    smartReplies: ['Score IGPP', 'Risque de retard DG', 'Analyse stratégique DG', 'Voir Dashboard'],
    actionLine:
      'Avant d’escalader une alerte, vérifier si le KPI se traduit par une décision réelle et immédiatement actionnable.',
    keywords: ['dashboard', 'kpi', 'igpp', 'retard', 'pilotage'],
    templates: [
      'Comment interpréter le dashboard GEM-MINT ?',
      'Quels KPIs sont réellement utiles pour piloter le projet ?',
      'Comment détecter un risque de retard depuis le dashboard ?',
      'Que signifie un taux de certification faible ?',
      'Comment distinguer un incident ponctuel d’une dérive de méthode ?',
    ],
  },
  kobo: {
    title: 'Kobo et collecte terrain',
    summary:
      'Kobo capture le terrain au plus près de l’exécution, puis rapproche les formulaires avec GEM-MINT via le numeroordre.',
    meaning:
      "Une bonne collecte Kobo se juge sur la qualité du rapprochement avec le ménage, le GPS, les photos et l'état réel du chantier.",
    anchors: [
      'Le numeroordre doit rester unique pour chaque ménage.',
      'La précision GPS doit rester cohérente avec la concession observée.',
      'Les champs critiques et les photos de preuve doivent être complets avant validation.',
      'La synchronisation doit préserver la vérité du terrain sans doublon ni perte silencieuse.',
    ],
    references: ['KOBO_STANDARDS', 'MISSION_SAGE_INTEGRATION_README', 'AIKnowledgeBase GEM-MINT'],
    smartReplies: ['Synchronisation Kobo', 'Que faire si Kobo ne remonte pas ?', 'Quels champs Kobo sont obligatoires ?', 'Comment éviter les doublons Kobo ?'],
    actionLine:
      'Avant de conclure à une panne Kobo, vérifier le numeroordre, la connectivité, les champs critiques et la cohérence GPS.',
    keywords: ['kobo', 'numeroordre', 'gps', 'collecte', 'formulaire', 'sync'],
    templates: [
      'Comment Kobo doit-il être utilisé correctement sur le terrain ?',
      'Que faire si Kobo ne se synchronise pas ?',
      'Pourquoi le numeroordre est-il critique ?',
      'Comment éviter les doublons dans Kobo ?',
      'Quels contrôles faire avant validation d’un formulaire Kobo ?',
    ],
  },
  security: {
    title: 'Rôles et droits',
    summary:
      'Les droits protègent la traçabilité, la responsabilité et la qualité des validations.',
    meaning:
      "Quand une action est interdite, ce n'est pas un simple blocage d'interface. C'est souvent une barrière contre l'altération d'une donnée déjà certifiée.",
    anchors: [
      'Chaque rôle agit dans un périmètre défini.',
      'Les validations critiques doivent rester attribuables.',
      'Une donnée certifiée ne doit pas être modifiée sans règle explicite.',
      'Les journaux d’audit servent à reconstituer la responsabilité des actions.',
    ],
    references: ['RBAC interne', 'MISSION_SAGE_INTEGRATION_README'],
    smartReplies: ['Mes droits', 'Historique des actions', 'Qui valide les OM ?', 'Organisation'],
    actionLine:
      'Avant de lever une restriction, vérifier si elle protège une donnée certifiée, une validation hiérarchique ou un périmètre de responsabilité.',
    keywords: ['droit', 'droits', 'permission', 'rbac', 'securite', 'sécurité'],
    templates: [
      'Pourquoi certains rôles ne peuvent-ils pas modifier certaines données ?',
      'Comment fonctionnent les droits dans GEM-MINT ?',
      'À quoi servent les logs d’audit dans la sécurité ?',
      'Pourquoi une donnée certifiée ne doit-elle pas être modifiée librement ?',
      'Comment protéger la traçabilité des validations ?',
    ],
  },
  report: {
    title: 'Rapports et exports',
    summary:
      'Un rapport utile doit restituer le fait, la justification et la décision attendue, pas seulement une capture de données.',
    meaning:
      "L'objectif d'un rapport Word ou PDF est de figer une lecture compréhensible par un décideur, un contrôleur ou un auditeur.",
    anchors: [
      'Le rapport doit décrire le contexte, l’écart et l’impact.',
      'Il doit relier les observations aux décisions prises.',
      'Il doit rester traçable après diffusion.',
      'Le contenu doit rester exploitable par un responsable non technique.',
    ],
    references: ['WordReportService', 'PVDocGenerator', 'Rapports internes GEM-MINT'],
    smartReplies: ['Générer un rapport Word', 'Exporter un rapport PDF', 'Contenu du rapport stratégique', 'Comment partager un rapport ?'],
    actionLine:
      'Avant diffusion, vérifier que le rapport permet à la fois la compréhension rapide et l’audit détaillé.',
    keywords: ['rapport', 'word', 'pdf', 'export', 'pv'],
    templates: [
      'Que doit contenir un bon rapport GEM-MINT ?',
      'Comment structurer un rapport pour la DG ?',
      'Pourquoi un rapport doit-il relier observation et décision ?',
      'Quelle différence entre une extraction brute et un rapport exploitable ?',
      'Comment rendre un rapport utile pour un auditeur ?',
    ],
  },
  decision: {
    title: 'Analyse stratégique',
    summary:
      'La décision DG doit combiner le terrain, la capacité d’exécution, les anomalies et la consommation budgétaire.',
    meaning:
      "Une synthèse utile ne doit pas empiler des chiffres. Elle doit montrer ce qui ralentit, ce qui coûte et ce qui doit être arbitré maintenant.",
    anchors: [
      'Comparer retards, certifications et budget sur un même horizon.',
      'Identifier les régions ou chaînes métier réellement sous tension.',
      'Distinguer incident ponctuel et dérive structurelle.',
      'Formuler un arbitrage clair et actionnable.',
    ],
    references: ['DecisionEngine', 'KPIs projet', 'AIKnowledgeBase GEM-MINT'],
    smartReplies: ['Analyse stratégique DG', 'Risque de retard DG', 'Rapport stratégique DG', 'Voir Dashboard'],
    actionLine:
      'Avant d’émettre une recommandation DG, rattacher chaque alerte à un impact mesurable et à un arbitrage concret.',
    keywords: ['decision', 'décision', 'dg', 'strategie', 'stratégie', 'igpp'],
    templates: [
      'Comment formuler une analyse stratégique DG utile ?',
      'Que signifie un score IGPP faible ?',
      'Comment relier retards, budget et anomalies dans une même décision ?',
      'Quels arbitrages prioriser quand plusieurs régions sont en retard ?',
      'Comment produire une synthèse DG robuste et argumentée ?',
    ],
  },
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      normalizeText(text)
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    )
  );
}

function anchorMatches(answer: string, anchor: string): boolean {
  const answerNorm = normalizeText(answer);
  const keywords = extractKeywords(anchor);
  if (keywords.length === 0) return answerNorm.includes(normalizeText(anchor));

  const matches = keywords.filter((keyword) => answerNorm.includes(keyword)).length;
  const required = Math.max(1, Math.min(keywords.length, Math.ceil(keywords.length * 0.45)));
  return matches >= required;
}

function countRepeatedLines(answer: string): number {
  const lines = answer
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);
  const seen = new Set<string>();
  let repeated = 0;

  for (const line of lines) {
    if (seen.has(line)) repeated += 1;
    else seen.add(line);
  }

  return repeated;
}

function buildOperationalReferenceAnswer(entry: OperationalReferenceEntry): string {
  return [
    `**${entry.title}**`,
    '',
    entry.summary,
    '',
    entry.meaning,
    '',
    `**Points essentiels**`,
    ...entry.anchors.map((anchor, index) => `${index + 1}. ${anchor}`),
    '',
    entry.actionLine ? `**Action utile**\n${entry.actionLine}` : '',
    entry.references.length > 0 ? `**Références**\n- ${entry.references.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function pickOperationalEntry(question: string): OperationalReferenceEntry | null {
  const normalized = normalizeText(question);
  let bestEntry: OperationalReferenceEntry | null = null;
  let bestScore = 0;

  for (const entry of Object.values(OPERATIONAL_REFERENTIAL)) {
    const score = entry.keywords.filter((keyword) => normalized.includes(normalizeText(keyword))).length;
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore > 0 ? bestEntry : null;
}

function ensureUniqueQuestions(questions: DeepAuditQuestion[]): DeepAuditQuestion[] {
  const seen = new Set<string>();
  const unique: DeepAuditQuestion[] = [];

  for (const question of questions) {
    const key = normalizeText(question.question);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(question);
  }

  return unique;
}

function expandDeepVariants(question: DeepAuditQuestion): DeepAuditQuestion[] {
  const variants = [
    `Réponds comme un contrôleur PROQUELEC : ${question.question}`,
    `Analyse en profondeur et valide la cohérence technique de ceci : ${question.question}`,
    `Donne une réponse structurée, la référence, les points de contrôle et l'action utile : ${question.question}`,
    `Explique avec justification métier et technique : ${question.question}`,
  ];

  return variants.map((variant, index) => ({
    ...question,
    id: `${question.id}::variant-${index + 1}`,
    question: variant,
  }));
}

function createQuestion(
  id: string,
  domain: string,
  question: string,
  expectedAnchors: string[],
  expectedReferences: string[],
  referenceAnswer: string,
  options?: Partial<Omit<DeepAuditQuestion, 'id' | 'domain' | 'question' | 'expectedAnchors' | 'expectedReferences' | 'referenceAnswer'>>
): DeepAuditQuestion {
  return {
    id,
    domain,
    question,
    expectedAnchors,
    expectedReferences,
    referenceAnswer,
    allowAutomaticOverride: true,
    ...options,
  };
}

function createOperationalQuestions(): DeepAuditQuestion[] {
  const questions: DeepAuditQuestion[] = [];

  for (const [domain, entry] of Object.entries(OPERATIONAL_REFERENTIAL)) {
    const referenceAnswer = buildOperationalReferenceAnswer(entry);

    entry.templates.forEach((template, index) => {
      questions.push(
        createQuestion(
          `ops:${domain}:${index + 1}`,
          domain,
          template,
          entry.anchors,
          entry.references,
          referenceAnswer,
          {
            smartReplies: entry.smartReplies,
          }
        )
      );
    });

    entry.anchors.forEach((anchor, index) => {
      questions.push(
        createQuestion(
          `ops:${domain}:anchor:${index + 1}`,
          domain,
          `Pourquoi ce point est-il critique dans ${entry.title.toLowerCase()} : ${anchor} ?`,
          [anchor],
          entry.references,
          referenceAnswer,
          {
            smartReplies: entry.smartReplies,
          }
        )
      );
    });
  }

  return questions.flatMap((question) => [question, ...expandDeepVariants(question)]);
}

function createTechnicalReferenceAnswer(definition: TechnicalDefinition): string {
  return (
    getTechnicalAnswer(definition.title)?.message ||
    [
      `**${definition.title}**`,
      '',
      `Objet : ${definition.description}`,
      `Référence : ${definition.norm}`,
      '',
      `**Exigences techniques**`,
      ...definition.specs.map((spec, index) => `${index + 1}. ${spec}`),
    ].join('\n')
  );
}

function createTechnicalQuestions(): DeepAuditQuestion[] {
  const questions: DeepAuditQuestion[] = [];

  for (const [key, definition] of Object.entries(ELECTRICIAN_GUIDE)) {
    const referenceAnswer = createTechnicalReferenceAnswer(definition);
    const smartReplies = definition.keywords.slice(0, 4).map((keyword) => toTitleCase(keyword.trim()));
    const coreAnchors = definition.specs.slice(0, 4);

    const generalQuestions = [
      `Quelle est la règle de référence pour ${definition.title} ?`,
      `Comment contrôler ${definition.title} sur le terrain ?`,
      `Quels sont les points critiques de ${definition.title} ?`,
      `Quelles non-conformités rejettent ${definition.title} ?`,
      `Quelle action corrective appliquer si ${definition.title} est non conforme ?`,
    ];

    generalQuestions.forEach((question, index) => {
      questions.push(
        createQuestion(
          `tech:${key}:general:${index + 1}`,
          key,
          question,
          coreAnchors,
          [definition.norm, definition.sourceFamily || 'Référentiel technique'],
          referenceAnswer,
          {
            expectedAction: definition.correctiveActions?.[0],
            expectedVerdict: definition.defaultVerdict,
            expectedSeverity: definition.defaultSeverity,
            expectedForbiddenPractices: definition.forbiddenPractices,
            smartReplies,
          }
        )
      );
    });

    definition.specs.forEach((spec, index) => {
      const expectedAnchors = [spec, ...definition.specs.filter((_, idx) => idx !== index).slice(0, 2)];
      const questionSet = [
        `Explique précisément cette règle pour ${definition.title} : ${spec}`,
        `Comment vérifier sur le terrain la règle suivante : ${spec} ?`,
        `Quel risque métier ou sécurité justifie cette exigence : ${spec} ?`,
      ];

      questionSet.forEach((question, questionIndex) => {
        questions.push(
          createQuestion(
            `tech:${key}:spec:${index + 1}:${questionIndex + 1}`,
            key,
            question,
            expectedAnchors,
            [definition.norm],
            referenceAnswer,
            {
              expectedAction: definition.correctiveActions?.[0],
              expectedVerdict: definition.defaultVerdict,
              expectedSeverity: definition.defaultSeverity,
              smartReplies,
            }
          )
        );
      });
    });

    (definition.criticalChecks || []).forEach((check, index) => {
      questions.push(
        createQuestion(
          `tech:${key}:check:${index + 1}`,
          key,
          `Pourquoi ce point de contrôle est-il indispensable pour ${definition.title} : ${check} ?`,
          [check],
          [definition.norm],
          referenceAnswer,
          {
            expectedAction: definition.correctiveActions?.[0],
            expectedVerdict: definition.defaultVerdict,
            expectedSeverity: definition.defaultSeverity,
            smartReplies,
          }
        )
      );
    });

    (definition.forbiddenPractices || []).forEach((practice, index) => {
      questions.push(
        createQuestion(
          `tech:${key}:forbidden:${index + 1}`,
          key,
          `Pourquoi cette pratique doit-elle être rejetée pour ${definition.title} : ${practice} ?`,
          [practice],
          [definition.norm],
          referenceAnswer,
          {
            expectedAction: definition.correctiveActions?.[0],
            expectedVerdict: definition.defaultVerdict,
            expectedSeverity: definition.defaultSeverity,
            expectedForbiddenPractices: definition.forbiddenPractices,
            smartReplies,
          }
        )
      );
    });
  }

  return questions.flatMap((question) => [question, ...expandDeepVariants(question)]);
}

function createKoboQuestions(): DeepAuditQuestion[] {
  const referenceAnswer = buildOperationalReferenceAnswer(OPERATIONAL_REFERENTIAL.kobo);
  const questions: DeepAuditQuestion[] = [];

  Object.entries(KOBO_STANDARDS).forEach(([key, value], index) => {
    const questionSet = [
      `Quelle est la règle Kobo suivante et pourquoi compte-t-elle : ${value}`,
      `Comment contrôler l'exigence Kobo "${key}" sur le terrain ?`,
      `Que risque-t-on si la règle Kobo "${key}" n'est pas respectée ?`,
    ];

    questionSet.forEach((question, questionIndex) => {
      questions.push(
        createQuestion(
          `kobo:${key}:${index + 1}:${questionIndex + 1}`,
          'kobo',
          question,
          [value],
          ['KOBO_STANDARDS', 'MISSION_SAGE_INTEGRATION_README'],
          referenceAnswer,
          {
            smartReplies: OPERATIONAL_REFERENTIAL.kobo.smartReplies,
          }
        )
      );
    });
  });

  return questions.flatMap((question) => [question, ...expandDeepVariants(question)]);
}

function createKnowledgeBaseQuestions(): DeepAuditQuestion[] {
  return generateKnowledgeQuestions(220)
    .map((question, index) => {
      const technical = getTechnicalAnswer(question);
      const operationalEntry = pickOperationalEntry(question);

      if (technical) {
        return createQuestion(
          `kb:tech:${index + 1}`,
          'technical',
          question,
          technical.message
            .split('\n')
            .filter((line) => /^\d+\./.test(line) || line.startsWith('- '))
            .slice(0, 4),
          [technical.reference],
          technical.message,
          {
            expectedAction: technical.recommendedAction,
            expectedVerdict: technical.verdict,
            expectedSeverity: technical.severity,
          }
        );
      }

      if (operationalEntry) {
        return createQuestion(
          `kb:ops:${index + 1}`,
          'operational',
          question,
          operationalEntry.anchors,
          operationalEntry.references,
          buildOperationalReferenceAnswer(operationalEntry),
          {
            smartReplies: operationalEntry.smartReplies,
          }
        );
      }

      return createQuestion(
        `kb:global:${index + 1}`,
        'global',
        question,
        OPERATIONAL_REFERENTIAL.global.anchors,
        OPERATIONAL_REFERENTIAL.global.references,
        buildOperationalReferenceAnswer(OPERATIONAL_REFERENTIAL.global),
        {
          smartReplies: OPERATIONAL_REFERENTIAL.global.smartReplies,
        }
      );
    })
    .flatMap((question) => [question, ...expandDeepVariants(question)]);
}

export function generateDeepAuditQuestions(limit = 1200): DeepAuditQuestion[] {
  const questions = ensureUniqueQuestions([
    ...createOperationalQuestions(),
    ...createTechnicalQuestions(),
    ...createKoboQuestions(),
    ...createKnowledgeBaseQuestions(),
  ]);

  return questions.slice(0, Math.max(1, limit));
}

export function evaluateAnswerAgainstReference(
  question: DeepAuditQuestion,
  answer: string
): AnswerEvaluation {
  const normalizedAnswer = normalizeText(answer);
  const matchedAnchors = question.expectedAnchors.filter((anchor) => anchorMatches(answer, anchor));
  const missingAnchors = question.expectedAnchors.filter((anchor) => !anchorMatches(answer, anchor));
  const matchedReferences = question.expectedReferences.filter((reference) =>
    anchorMatches(answer, reference)
  );
  const missingReferences = question.expectedReferences.filter(
    (reference) => !anchorMatches(answer, reference)
  );

  const coverageRatio =
    question.expectedAnchors.length > 0 ? matchedAnchors.length / question.expectedAnchors.length : 1;
  const referenceRatio =
    question.expectedReferences.length > 0
      ? matchedReferences.length / question.expectedReferences.length
      : 1;

  let structureScore = 0;
  if (answer.trim().length >= 80) structureScore += 4;
  if (/\n/.test(answer) || /[-*]\s|\d+\./.test(answer)) structureScore += 3;
  if (/\*\*|référence|points|action|verdict|gravité/i.test(answer)) structureScore += 3;

  const verdictScore = question.expectedVerdict
    ? normalizedAnswer.includes(normalizeText(question.expectedVerdict))
      ? 5
      : 0
    : 0;
  const severityScore = question.expectedSeverity
    ? normalizedAnswer.includes(normalizeText(question.expectedSeverity))
      ? 5
      : 0
    : 0;
  const actionScore = question.expectedAction
    ? anchorMatches(answer, question.expectedAction)
      ? 5
      : 0
    : 0;
  const repetitionPenalty = Math.min(12, countRepeatedLines(answer) * 2);

  const totalScore = Math.max(
    0,
    Math.round(
      coverageRatio * 60 +
        referenceRatio * 15 +
        structureScore +
        verdictScore +
        severityScore +
        actionScore -
        repetitionPenalty
    )
  );

  const issues: string[] = [];
  if (answer.trim().length < 80) issues.push('Réponse trop courte pour couvrir correctement la question.');
  if (missingAnchors.length > 0) {
    issues.push(`Points non couverts : ${missingAnchors.slice(0, 4).join(' | ')}`);
  }
  if (missingReferences.length > 0) {
    issues.push(`Références absentes : ${missingReferences.join(' | ')}`);
  }
  if (question.expectedVerdict && verdictScore === 0) {
    issues.push(`Verdict attendu non explicitement formulé (${question.expectedVerdict}).`);
  }
  if (question.expectedSeverity && severityScore === 0) {
    issues.push(`Niveau de gravité attendu non explicitement formulé (${question.expectedSeverity}).`);
  }
  if (question.expectedAction && actionScore === 0) {
    issues.push('Action corrective ou action utile insuffisamment explicitée.');
  }
  if (repetitionPenalty > 0) {
    issues.push('La réponse contient des répétitions visibles.');
  }

  return {
    totalScore,
    coverageScore: Math.round(coverageRatio * 60),
    referenceScore: Math.round(referenceRatio * 15),
    structureScore,
    verdictScore,
    severityScore,
    actionScore,
    repetitionPenalty,
    matchedAnchors,
    missingAnchors,
    missingReferences,
    issues,
  };
}

export function compareAnswerPair(question: DeepAuditQuestion, aiAnswer: string): DeepAuditComparison {
  const aiEvaluation = evaluateAnswerAgainstReference(question, aiAnswer);
  const referenceEvaluation = evaluateAnswerAgainstReference(question, question.referenceAnswer);
  const preferredAnswer =
    referenceEvaluation.totalScore >= aiEvaluation.totalScore + 8 ? 'reference' : 'ai';

  return {
    question,
    aiAnswer,
    referenceAnswer: question.referenceAnswer,
    aiEvaluation,
    referenceEvaluation,
    preferredAnswer,
  };
}

export function buildOverrideCatalog(
  comparisons: DeepAuditComparison[],
  threshold = 70
): Record<string, GeneratedMissionSageOverride> {
  const overrides: Record<string, GeneratedMissionSageOverride> = {};

  for (const comparison of comparisons) {
    const { question, aiEvaluation, referenceEvaluation, preferredAnswer } = comparison;
    if (!question.allowAutomaticOverride) continue;
    if (preferredAnswer !== 'reference') continue;
    if (referenceEvaluation.totalScore < threshold) continue;

    overrides[normalizeText(question.question)] = {
      question: question.question,
      domain: question.domain,
      message: question.referenceAnswer,
      smartReplies: question.smartReplies,
      verdict: question.expectedVerdict,
      severity: question.expectedSeverity,
      recommendedAction: question.expectedAction,
      referenceScore: referenceEvaluation.totalScore,
      aiScore: aiEvaluation.totalScore,
    };
  }

  return overrides;
}

export function formatOverrideModule(
  overrides: Record<string, GeneratedMissionSageOverride>
): string {
  const serialized = JSON.stringify(overrides, null, 2);

  return `export interface GeneratedMissionSageOverride {
  question: string;
  domain: string;
  message: string;
  smartReplies?: string[];
  verdict?: 'Conforme' | 'Conforme sous réserve' | 'Non conforme' | 'A verifier';
  severity?: 'critique' | 'majeure' | 'mineure' | 'information';
  recommendedAction?: string;
  referenceScore: number;
  aiScore: number;
}

export const GENERATED_MISSION_SAGE_OVERRIDES: Record<string, GeneratedMissionSageOverride> = ${serialized};

export function findGeneratedMissionSageOverride(normalizedQuery: string): GeneratedMissionSageOverride | null {
  return GENERATED_MISSION_SAGE_OVERRIDES[normalizedQuery] || null;
}
`;
}

export function normalizeAuditQuestion(text: string): string {
  return normalizeText(text);
}

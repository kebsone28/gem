import { KOBO_STANDARDS } from './ElectricianQuran';

export interface AIStateForPrompt {
  stats?: { totalMissions?: number; totalCertified?: number; totalIndemnities?: number } | null;
  households?: unknown[];
  auditLogs?: unknown[];
}

const CORE_KNOWLEDGE = [
  'PROQUELEC gère l’électrification de masse au Sénégal via la plateforme GEM-MINT.',
  'GEM-MINT orchestre les missions OM : création, validation par Chef de Projet, certification DG.',
  'La collecte terrain est réalisée via Kobo Collect et synchronisée par numeroordre.',
  'La norme applicâble est NS 01-001 pour les installations basse tension (BT ≤ 1000 V).',
  'Le branchement Senelec doit respecter le coffret en limite de propriété et la hauteur réglementaire.',
  'Les statuts métier des ménages sont : Non encore installée, Murs, Réseau, Intérieur, Contrôle conforme, Ménage non éligible, Problème.',
  'Le calcul des indemnités de mission se base sur les coûts de matériel, main-d’œuvre, logistique et barème PROQUELEC.',
  'Les indemnités sont validées après certification DG et peuvent être consultées par les rôles autorisés.',
  'La sécurité électrique repose sur DDR, prise terre PE vert/jaune, et protections mécanique PVC.',
  'Les anomalies à éviter : fils visibles, barrette terre extérieure, poteaux bois pourris.',
  // NOUVEAUX ÉLÉMENTS TECHNIQUES AJOUTÉS
  'Le branchement Senelec nécessite impérativement un coffret en limite de propriété avec hublot à 1.60m minimum.',
  'Les anomalies critiques incluent : poteaux bois pourris, câbles non enterrés, absence de prise terre, fils visibles.',
  "L'installation intérieure MFR standard comprend : coffret disjoncteur, 3 lampes, 1 prise, interrupteurs en zone couverte.",
  'La protection mécanique utilise des tubes PVC pour tous les câbless enterrés ou en saillie.',
  'Le DDR (dispositif de coupure fuite terre) est obligatoire pour toute installation BT ≤ 1000V.',
  'Les coordonnées GPS doivent être vérifiées sur site avec précision de ±5m pour éviter les erreurs de localisation.',
  'Le numeroordre est unique par ménage et sert de clé primaire pour la synchronisation Kobo.',
  'Les missions complexes nécessitent validation hiérarchique : Chef Équipe → Chef Projet → DG.',
  "Le barème PROQUELEC inclut : matériel électrique, main-d'œuvre spécialisée, logistique terrain, transport.",
  'Les problèmes de terrain courants : absence de poteau, refus client, coordonnées GPS incorrectes, anomalies techniques.',
];

const TECHNICAL_SUMMARIES = [
  {
    title: 'Branchement Senelec',
    text: 'Coffret compteur en limite propriété, hublot à 1.60m, câble enterré 0.5m sous grillage rouge, hauteur ≥ 4m en ruelle et ≥ 6m sur route, protection mécanique PVC obligatoire.',
  },
  {
    title: 'Installation intérieure MFR',
    text: 'Coffret disjoncteur dans un couloir couvert, interrupteurs en zone couverte, config standard 3 lampes / 1 prise, câbles armés enterrés.',
  },
  {
    title: 'Anomalies à éviter',
    text: 'Fils visibles, câbles extérieurs, barrette terre en dehors du bâtiment, poteau bois pourri, surplombement interdit.',
  },
  {
    title: 'Glossaire technique',
    text: 'Partie active = conducteur sous tension, masse = élément touchable pouvant être sous tension, DDR = dispositif de coupure fuite terre, PE = prise terre vert/jaune.',
  },
  // NOUVEAUX RÉSUMÉS TECHNIQUES AJOUTÉS
  {
    title: 'Sécurité électrique',
    text: 'DDR obligatoire BT ≤ 1000V, prise terre PE vert/jaune, protection mécanique PVC, absence de masses touchables sous tension.',
  },
  {
    title: 'Synchronisation Kobo',
    text: 'numeroordre unique par ménage, vérification GPS ±5m, synchronisation automatique, gestion des conflits de données.',
  },
  {
    title: 'Calcul des indemnités',
    text: "Matériel électrique + main-d'œuvre spécialisée + logistique terrain + transport. Validation DG obligatoire.",
  },
];

function formatKnowledgeItems(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function buildPublicAIKnowledgePrompt(
  query: string,
  user?: { role?: string; displayName?: string; name?: string; email?: string },
  state?: AIStateForPrompt
): string {
  const stats = state?.stats;
  const statsLines = stats
    ? [
        `• Total missions : ${stats.totalMissions ?? 0}`,
        `• Missions certifiées : ${stats.totalCertified ?? 0}`,
        `• Indemnités totales : ${stats.totalIndemnities ? new Intl.NumberFormat('fr-FR').format(stats.totalIndemnities) + ' FCFA' : 'N/A'}`,
      ]
    : ['Aucune statistique disponible.'];

  const technicalDetails = TECHNICAL_SUMMARIES.map(
    (item) => `**${item.title}** : ${item.text}`
  ).join('\n');

  const koboDetails = Object.entries(KOBO_STANDARDS)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `Tu es MissionSage, l'assistant IA expert du système GEM-MINT de PROQUELEC.

BASE DE CONNAISSANCES GEM-MINT:
${formatKnowledgeItems(CORE_KNOWLEDGE)}

TECHNIQUE & NORMES:
${technicalDetails}

KOBO & SYNCHRONISATION:
${koboDetails}

UTILISATEUR ACTUEL:
- Rôle: ${user?.role || 'Inconnu'}
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Email: ${user?.email || 'N/A'}

STATISTIQUES SYSTÈME:
${statsLines.join('\n')}

FINANCES & INDEMNITÉS:
- Le calcul des indemnités de mission inclut le matériel, la main-d’œuvre, la logistique et la grille tarifaire PROQUELEC.
- Les indemnités sont validées une fois la mission certifiée par la DG.

STATUTS MÉNAGES:
- Les statuts sont : Non encore installée, Murs, Réseau, Intérieur, Contrôle conforme, Ménage non éligible, Problème.

INSTRUCTION:
- Utilise uniquement les informations de la base de connaissances ci-dessus.
- Si la question peut être satisfaite par la base, réponds directement en citant le contexte.
- Si la question porte sur un processus métier, mentionne les rôles PROQUELEC et les étapes OM.
- Si la question porte sur la technique, inclue les normes NS 01-001, la sécurité et le vocabulaire métier.
- Si la question porte sur Kobo, explique le rôle du numeroordre et la logique de synchronisation.
- Si la question porte sur finance, indemnités ou statut ménage, utilise les définitions explicites fournies.
- Donne une réponse structurée, professionnelle et concise.

QUESTION UTILISATEUR: ${query}`;
}

const BASE_QUESTION_CATEGORIES: Record<string, string[]> = {
  mission: [
    'Comment créer une nouvelle mission OM ?',
    'Qui valide une mission ?',
    'Comment la DG certifie une mission ?',
    'Comment corriger une mission rejetée ?',
  ],
  finance: [
    'Comment calculer les indemnités de mission ?',
    'Que faire en cas de dépassement budgétaire ?',
    'Comment suivre le budget des projets ?',
  ],
  kobo: [
    'Comment synchroniser Kobo Collect avec GEM-MINT ?',
    'Comment éviter les doublons Kobo ?',
    'Quels champs Kobo sont obligatoires ?',
  ],
  norme: [
    'Quelles installations couvre la norme NS 01-001 ?',
    'Quelle tension est permise par la norme NS 01-001 ?',
    'Quelles sont les exclusions de la norme NS 01-001 ?',
  ],
  senelec: [
    'Où installer le coffret compteur Senelec ?',
    'Quelle est la hauteur réglementaire du hublot ?',
    'Comment protéger le câble de branchement ?',
  ],
  protection: [
    'Quelles protections doivent être installées ?',
    'Qu est-ce qu un DDR et pourquoi est-il obligatoire ?',
    'Quelle est la couleur standard du conducteur de protection ?',
  ],
  glossary: [
    'Qu est-ce qu une partie active ?',
    'Qu est-ce qu une masse électrique ?',
    'Quelle est la section standard d un câble ?',
  ],
};

export function generateKnowledgeQuestions(limit = 100): string[] {
  const questions: string[] = [];
  for (const category of Object.values(BASE_QUESTION_CATEGORIES)) {
    questions.push(...category);
  }
  const variants = Object.values(BASE_QUESTION_CATEGORIES)
    .flat()
    .map((q) => q.replace(/\?/g, '').trim())
    .flatMap((q) => [`${q} ?`, `${q}`]);
  questions.push(...variants);
  return Array.from(new Set(questions)).slice(0, limit);
}

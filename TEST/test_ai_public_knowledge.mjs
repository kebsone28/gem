import { writeFileSync } from 'fs';

const USER = {
  role: 'ADMIN_PROQUELEC',
  displayName: 'Test User',
  email: 'test@proquelec.sn',
};

const STATE = {
  stats: {
    totalMissions: 150,
    totalCertified: 120,
    totalHouseholds: 2500,
    totalIndemnities: 25000000,
  },
  households: [],
  auditLogs: [],
};

const BASE_QUESTIONS = [
  'Comment créer une nouvelle mission OM ?',
  'Qui valide une mission ?',
  'Comment la DG certifie une mission ?',
  'Comment corriger une mission rejetée ?',
  'Comment calculer les indemnités de mission ?',
  'Que faire en cas de dépassement budgétaire ?',
  'Comment suivre le budget des projets ?',
  'Comment synchroniser Kobo Collect avec GEM-MINT ?',
  'Comment éviter les doublons Kobo ?',
  'Quels champs Kobo sont obligatoires ?',
  'Quelles installations couvre la norme NS 01-001 ?',
  'Quelle tension est permise par la norme NS 01-001 ?',
  'Quelles sont les exclusions de la norme NS 01-001 ?',
  'Où installer le coffret compteur Senelec ?',
  'Quelle est la hauteur réglementaire du hublot ?',
  'Comment protéger le câble de branchement ?',
  'Quelles protections doivent être installées ?',
  'Qu est-ce qu un DDR et pourquoi est-il obligatoire ?',
  'Quelle est la couleur standard du conducteur de protection ?',
  'Qu est-ce qu une partie active ?',
  'Qu est-ce qu une masse électrique ?',
  'Quelle est la section standard d un câble ?',
  'Comment vérifier la conformité d un branchement Senelec ?',
  'Comment corriger une anomalie d installation ?',
  'Quels sont les types de défauts à éviter ?',
  'Comment générer un rapport stratégique DG ?',
  'Comment utiliser les données Kobo pour le pilotage ?',
  'Quels sont les statuts d un menage dans GEM-MINT ?',
  'Comment fonctionne le workflow OM ?',
  'Comment trouver les missions non certifiees ?',
  'Que faire si l on n a pas de connexion terrain pour Kobo ?',
];

const KNOWLEDGE_PROMPT = `Tu es MissionSage, l'assistant IA expert du système GEM-MINT de PROQUELEC.

BASE DE CONNAISSANCES:
- PROQUELEC gère l'électrification de masse au Sénégal via l'application GEM-MINT.
- GEM-MINT orchestre les missions OM: création, validation par Chef de Projet et certification DG.
- Kobo Collect est utilisé pour la collecte terrain et la synchronisation se fait par numeroordre.
- La norme applicâble est NS 01-001 pour les installations BT ≤1000V.
- Le branchement Senelec doit respecter le coffret limite propriété, hublot 1.60m, câble enterré 0.5m sous grillage rouge.
- La sécurité électrique utilise DDR, prise terre PE vert/jaune et protection mécanique PVC.
- Les anomalies majeures à éviter sont les fils visibles, courroies à l'air libre, barrettes de terre extérieures et poteaux bois pourris.
- Le calcul des indemnités de mission inclut le matériel, la main-d’œuvre, la logistique et le barème PROQUELEC.
- Les indemnités sont validées après certification DG.
- Les statuts d’un ménage dans GEM-MINT sont : Non débuté, Murs, Réseau, Intérieur, Contrôle conforme, Ménage non éligible, Problème.

INSTRUCTION:
- Utilise uniquement les informations de cette base de connaissances.
- Si la question porte sur un sujet listé ici, réponds en t'appuyant sur ce qui est fourni.
- Donne une réponse structurée, claire et professionnelle.
- Cite les normes et les étapes pertinentes.

`;

function buildPrompt(question) {
  return `${KNOWLEDGE_PROMPT}\nQUESTION UTILISATEUR: ${question}`;
}

async function callPublicAI(question) {
  const prompt = buildPrompt(question);
  const maxAttempts = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`
    );
    if (response.ok) {
      return await response.text();
    }

    lastError = `Pollinations error ${response.status}`;
    if (response.status === 429 && attempt < maxAttempts) {
      const delay = 1500 * attempt;
      console.warn(`429 rate limit, retrying after ${delay}ms... (attempt ${attempt})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError || 'Pollinations error inconnue');
}

function isCoherent(question, answer) {
  const q = question.toLowerCase();
  const a = answer.toLowerCase();
  if (!answer || answer.length < 50) return false;
  const keywords = [];
  if (q.includes('mission')) keywords.push('mission', 'om', 'chef', 'dg', 'validation', 'certif');
  if (q.includes('kobo')) keywords.push('kobo', 'numeroordre', 'synchron');
  if (q.includes('norme')) keywords.push('ns 01-001', 'norme', 'bt', 'conform');
  if (q.includes('senelec')) keywords.push('senelec', 'coffret', 'hublot', 'câble', 'branchement');
  if (q.includes('protection')) keywords.push('ddr', 'pe', 'terre', 'pvc', 'fusible');
  if (q.includes('partie active')) keywords.push('partie active');
  if (q.includes('masse électrique')) keywords.push('masse');
  if (q.includes('indemnité') || q.includes('budget')) keywords.push('indemnité', 'budget', 'coût', 'financ', 'gestion');
  if (q.includes('statut') || q.includes('ménage')) keywords.push('statut', 'non débuté', 'murs', 'réseau', 'intérieur', 'contrôle conforme', 'inéligible');
  return keywords.some((k) => a.includes(k));
}

async function main() {
  const results = [];
  for (const question of BASE_QUESTIONS) {
    console.log('Question:', question);
    try {
      const answer = await callPublicAI(question);
      const coherent = isCoherent(question, answer);
      const suggestedStaticAnswer = coherent && answer.length > 150 ? answer.trim() : null;
      console.log('Coherent:', coherent, '| Length:', answer.length);
      console.log(answer.slice(0, 250).replace(/\n/g, ' '), '\n---');
      results.push({ question, answer, coherent, length: answer.length, suggestedStaticAnswer });
    } catch (error) {
      console.error('Erreur:', error.message);
      results.push({ question, answer: null, coherent: false, error: error.message });
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  writeFileSync('ai_public_knowledge_report.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2), 'utf-8');
  console.log('Report saved to ai_public_knowledge_report.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
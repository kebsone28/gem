// Test d'intégration MissionSage - Version JavaScript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour simuler l'appel à l'IA publique
async function callPublicFreeAI(query, user, state) {
  const contextPrompt = `
Tu es MissionSage, l'assistant IA intelligent du système GEM-MINT de PROQUELEC.

CONTEXTE MÉTIER GEM-MINT:
- PROQUELEC est une entreprise sénégalaise d'électrification de masse
- GEM-MINT gère les missions d'ordres de mission (OM) pour l'électrification
- Les missions suivent les normes NS 01-001 pour installations BT ≤1000V
- Les techniciens utilisent Kobo Collect pour la collecte de données terrain
- Les données sont validées par les Chefs de Projet puis certifiées par la DG

UTILISATEUR ACTUEL:
- Rôle: ${user?.role || 'Inconnu'}
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Email: ${user?.email || 'N/A'}

STATISTIQUES SYSTÈME:
- Total missions: ${state?.stats?.totalMissions || 0}
- Missions certifiées: ${state?.stats?.totalCertified || 0}
- Ménages collectés: ${state?.stats?.totalHouseholds || 0}
- Indemnités totales: ${state?.stats?.totalIndemnities ? new Intl.NumberFormat('fr-FR').format(state.stats.totalIndemnities) + ' FCFA' : 'N/A'}

RÈGLES MÉTIER CLÉS:
- Les branchements doivent respecter la norme Senelec
- Coffret compteur en limite propriété, hublot à 1.60m
- Câbles enterrés 0.5m sous grillage rouge
- Protection PVC obligatoire, hauteur ≥4m ruelles/6m routes
- Interdiction poteaux bois pourris, barrettes terre extérieures

BASE CONNAISSANCES TECHNIQUES:
- Partie active = conducteur sous tension
- Masse = pièce touchable pouvant être sous tension
- DDR = dispositif de coupure fuite terre
- PE = prise terre vert/jaune
- Section câble standard: 1.5mm², 2.5mm², 4mm²

INSTRUCTION: Réponds en tant qu'expert PROQUELEC, utilise le contexte fourni, sois précis et professionnel.

QUESTION UTILISATEUR: ${query}
`;

  try {
    const response = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(contextPrompt)}?model=openai`
    );
    if (!response.ok) throw new Error('Service public Pollinations indisponible.');
    return await response.text();
  } catch (e) {
    throw e;
  }
}

async function testIntegration() {
  console.log('=== Test d\'intégration MissionSage ===\n');

  // Mock user et state
  const mockUser = {
    role: 'ADMIN_PROQUELEC',
    displayName: 'Test User',
    email: 'test@proquelec.sn'
  };

  const mockState = {
    stats: {
      totalMissions: 150,
      totalCertified: 120,
      totalHouseholds: 2500,
      totalIndemnities: 25000000
    }
  };

  const testQueries = [
    'Quelles sont les normes pour un branchement Senelec?',
    'Comment créer une mission OM?',
    'Expliquez la différence entre partie active et masse'
  ];

  for (const query of testQueries) {
    console.log(`\n--- Test: "${query}" ---`);
    try {
      const response = await callPublicFreeAI(query, mockUser, mockState);
      console.log('✅ Réponse reçue');
      console.log('Aperçu:', response.substring(0, 150) + '...');
    } catch (error) {
      console.log('❌ Erreur:', error.message);
    }
  }

  console.log('\n=== Test terminé ===');
}

testIntegration();
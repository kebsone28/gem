async function callPublicFreeAI(query, user, state) {
  // Enrichir le prompt avec le contexte métier GEM-MINT
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

async function test() {
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

  const queries = [
    'Quelles sont les règles pour installer un branchement Senelec?',
    'Comment créer une nouvelle mission OM?',
    'Quel est le statut de mes missions?',
    'Explique la norme NS 01-001'
  ];

  for (const q of queries) {
    console.log(`\n=== Testing: "${q}" ===`);
    try {
      const result = await callPublicFreeAI(q, mockUser, mockState);
      console.log('Response:', result.substring(0, 300) + '...');
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

test();
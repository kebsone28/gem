import { GEM_MINT_KNOWLEDGE_BASE, getContextePrompt } from './GEM_MINT_KNOWLEDGE_BASE.js';

/**
 * TEST CIBLÉ - Questions clés pour évaluer la maîtrise de l'IA
 */

async function testKeyQuestions() {
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

  // Questions stratégiques pour évaluer la compréhension
  const keyQuestions = [
    "Qu'est-ce que PROQUELEC et quel est son rôle dans l'électrification?",
    "Explique le workflow complet d'une mission OM de la création à la certification",
    "Quelles sont les règles techniques pour installer un branchement Senelec selon NS 01-001?",
    "Comment éviter les doublons lors de la synchronisation Kobo?",
    "Quelle est la différence entre partie active et masse en électricité?",
    "Comment fonctionne l'approbation multi-étapes des missions?",
    "Quels sont les KPIs principaux pour mesurer le succès d'un projet?",
    "Comment est organisée la sécurité dans GEM-MINT?"
  ];

  console.log('🧠 TEST IA - MAÎTRISE BASE DE CONNAISSANCES GEM-MINT\n');
  console.log('=' .repeat(80));

  for (let i = 0; i < keyQuestions.length; i++) {
    const question = keyQuestions[i];
    console.log(`\n[${i + 1}/${keyQuestions.length}] Question: ${question}`);

    try {
      const contextPrompt = getContextePrompt(mockUser, mockState);
      const fullPrompt = `${contextPrompt}\n\nQUESTION UTILISATEUR: ${question}\n\nRÉPONDS DE FAÇON DÉTAILLÉE, PRÉCISE ET PROFESSIONNELLE:`;

      const startTime = Date.now();
      const response = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`
      );
      const endTime = Date.now();

      if (!response.ok) throw new Error('Service indisponible');

      const result = await response.text();
      const responseTime = endTime - startTime;

      console.log(`✅ Réponse reçue (${responseTime}ms):`);
      console.log(result);
      console.log('-'.repeat(80));

    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
    }

    // Pause entre les questions
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n🎯 ANALYSE DES RÉPONSES:');
  console.log('Vérifiez si l\'IA:');
  console.log('✅ Utilise correctement le contexte PROQUELEC');
  console.log('✅ Respecte les normes NS 01-001');
  console.log('✅ Comprend le workflow métier');
  console.log('✅ Maîtrise la terminologie technique');
  console.log('✅ Donne des réponses précises et actionnables');
}

testKeyQuestions();
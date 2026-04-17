import { GEM_MINT_KNOWLEDGE_BASE, getContextePrompt } from './GEM_MINT_KNOWLEDGE_BASE.js';

/**
 * SCRIPT DE TEST COMPLÈT - IA AVEC BASE DE CONNAISSANCES COMPLÈTE
 * Teste toutes les questions possibles et analyse les réponses
 */

class AIKnowledgeTester {
  constructor() {
    this.results = {
      totalQuestions: 0,
      coherentResponses: 0,
      incoherentResponses: 0,
      errors: 0,
      responseTimes: [],
      detailedResults: []
    };

    this.mockUser = {
      role: 'ADMIN_PROQUELEC',
      displayName: 'Test User',
      email: 'test@proquelec.sn'
    };

    this.mockState = {
      stats: {
        totalMissions: 150,
        totalCertified: 120,
        totalHouseholds: 2500,
        totalIndemnities: 25000000
      }
    };
  }

  async callPublicFreeAI(query) {
    const contextPrompt = getContextePrompt(this.mockUser, this.mockState);

    const fullPrompt = `${contextPrompt}

QUESTION UTILISATEUR: ${query}

RÉPONDS DE FAÇON PROFESSIONNELLE, PRÉCISE ET UTILISE TOUTES LES CONNAISSANCES DISPONIBLES.`;

    try {
      const startTime = Date.now();
      const response = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`
      );
      const endTime = Date.now();

      if (!response.ok) throw new Error('Service indisponible');

      const result = await response.text();
      const responseTime = endTime - startTime;

      return { success: true, response: result, responseTime };
    } catch (error) {
      return { success: false, error: error.message, responseTime: 0 };
    }
  }

  // GÉNÈRE TOUTES LES QUESTIONS POSSIBLES
  generateAllQuestions() {
    const questions = [];

    // Questions sur le contexte général
    questions.push(
      "Qu'est-ce que PROQUELEC?",
      "Quel est l'objectif de GEM-MINT?",
      "Quelles sont les normes applicâbles?",
      "Comment fonctionne l'électrification nationale?"
    );

    // Questions sur l'architecture technique
    questions.push(
      "Quelle est la stack technique de GEM-MINT?",
      "Comment fonctionne le stockage des données?",
      "Qu'est-ce que MapLibre GL JS?",
      "Comment fonctionne la synchronisation offline?"
    );

    // Questions sur le workflow missions
    questions.push(
      "Comment créer une nouvelle mission OM?",
      "Quels sont les rôles dans le workflow d'approbation?",
      "Comment approuver une mission?",
      "Quelles sont les étapes d'une mission?"
    );

    // Questions sur les statuts ménage
    questions.push(
      "Quels sont les statuts possibles d'un ménage?",
      "Quelle est la différence entre 'Non débuté' et 'Ménage non éligible'?",
      "Comment évolue le statut d'un ménage?",
      "Quand un ménage est marqué 'Contrôle conforme'?"
    );

    // Questions techniques (NS 01-001)
    questions.push(
      "Quelles sont les règles pour un branchement Senelec?",
      "Où placer le coffret compteur?",
      "Comment enterrer les câbless?",
      "Qu'est-ce qu'une partie active?",
      "Qu'est-ce qu'une masse?",
      "Quelles sont les sections de câble standard?"
    );

    // Questions sur Kobo
    questions.push(
      "Comment synchroniser les données Kobo?",
      "Qu'est-ce que le numeroordre?",
      "Comment éviter les doublons Kobo?",
      "Quels champs sont extraits de Kobo?"
    );

    // Questions sécurité
    questions.push(
      "Comment fonctionne l'authentification?",
      "Quelle est la durée de validité des tokens?",
      "Comment sont protégées les données?"
    );

    // Questions base de données
    questions.push(
      "Comment est structurée la base de données?",
      "Quelles sont les tables principales?",
      "Comment fonctionne l'isolation multi-tenant?"
    );

    // Questions des FAQ
    GEM_MINT_KNOWLEDGE_BASE.faq.forEach(item => {
      questions.push(item.question);
    });

    // Questions sur les erreurs courantes
    Object.keys(GEM_MINT_KNOWLEDGE_BASE.erreurs_courantes).forEach(error => {
      questions.push(`Comment résoudre le problème de ${error.replace(/_/g, ' ')}?`);
    });

    // Questions sur les KPIs
    questions.push(
      "Comment calculer le taux d'électrification?",
      "Quels sont les KPIs importants?",
      "Comment mesurer le rendement des équipes?"
    );

    return [...new Set(questions)]; // Supprimer les doublons
  }

  evaluateResponseCoherence(question, response) {
    if (!response || response.length < 10) return false;

    const question_lower = question.toLowerCase();
    const response_lower = response.toLowerCase();

    // Vérifications de cohérence de base
    const coherenceChecks = [
      // Contexte PROQUELEC
      question_lower.includes('proquelec') && response_lower.includes('électrification'),
      question_lower.includes('gem-mint') && response_lower.includes('gestion'),

      // Workflow missions
      question_lower.includes('mission') && (response_lower.includes('om') || response_lower.includes('approbation')),
      question_lower.includes('statut') && response_lower.includes('ménage'),

      // Règles techniques
      question_lower.includes('branchement') && response_lower.includes('coffret'),
      question_lower.includes('câble') && response_lower.includes('enterr'),

      // Kobo
      question_lower.includes('kobo') && response_lower.includes('collect'),
      question_lower.includes('numeroordre') && response_lower.includes('unique'),

      // Sécurité
      question_lower.includes('authentification') && response_lower.includes('jwt'),
      question_lower.includes('token') && response_lower.includes('refresh')
    ];

    return coherenceChecks.some(check => check);
  }

  async runFullTest() {
    console.log('🚀 DÉMARRAGE TEST COMPLET IA AVEC BASE DE CONNAISSANCES\n');
    console.log('='.repeat(80));

    const questions = this.generateAllQuestions();
    this.results.totalQuestions = questions.length;

    console.log(`📊 ${questions.length} questions à tester\n`);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`[${i + 1}/${questions.length}] Testing: "${question}"`);

      const result = await this.callPublicFreeAI(question);

      if (result.success) {
        const isCoherent = this.evaluateResponseCoherence(question, result.response);
        this.results.responseTimes.push(result.responseTime);

        const status = isCoherent ? '✅ COHÉRENT' : '⚠️  PEUT MIEUX';
        if (isCoherent) this.results.coherentResponses++;
        else this.results.incoherentResponses++;

        console.log(`   ${status} (${result.responseTime}ms)`);
        console.log(`   Réponse: ${result.response.substring(0, 100)}...\n`);

        this.results.detailedResults.push({
          question,
          response: result.response,
          coherent: isCoherent,
          responseTime: result.responseTime
        });
      } else {
        this.results.errors++;
        console.log(`   ❌ ERREUR: ${result.error}\n`);

        this.results.detailedResults.push({
          question,
          error: result.error,
          coherent: false,
          responseTime: 0
        });
      }

      // Pause pour éviter la surcharge
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.displayResults();
  }

  displayResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSULTATS FINAUX DU TEST');
    console.log('='.repeat(80));

    console.log(`\n📈 STATISTIQUES GÉNÉRALES:`);
    console.log(`   Total questions: ${this.results.totalQuestions}`);
    console.log(`   Réponses cohérentes: ${this.results.coherentResponses} (${Math.round(this.results.coherentResponses / this.results.totalQuestions * 100)}%)`);
    console.log(`   Réponses à améliorer: ${this.results.incoherentResponses} (${Math.round(this.results.incoherentResponses / this.results.totalQuestions * 100)}%)`);
    console.log(`   Erreurs: ${this.results.errors} (${Math.round(this.results.errors / this.results.totalQuestions * 100)}%)`);

    if (this.results.responseTimes.length > 0) {
      const avgTime = Math.round(this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length);
      const minTime = Math.min(...this.results.responseTimes);
      const maxTime = Math.max(...this.results.responseTimes);
      console.log(`\n⏱️  PERFORMANCE:`);
      console.log(`   Temps moyen: ${avgTime}ms`);
      console.log(`   Temps min: ${minTime}ms`);
      console.log(`   Temps max: ${maxTime}ms`);
    }

    console.log(`\n🔍 ANALYSE DÉTAILLÉE:`);

    // Questions avec réponses incohérentes
    const incoherent = this.results.detailedResults.filter(r => !r.coherent && !r.error);
    if (incoherent.length > 0) {
      console.log(`\n⚠️  QUESTIONS À AMÉLIORER (${incoherent.length}):`);
      incoherent.forEach((result, idx) => {
        console.log(`   ${idx + 1}. "${result.question}"`);
        console.log(`      → ${result.response.substring(0, 80)}...`);
      });
    }

    // Erreurs
    const errors = this.results.detailedResults.filter(r => r.error);
    if (errors.length > 0) {
      console.log(`\n❌ ERREURS (${errors.length}):`);
      errors.forEach((result, idx) => {
        console.log(`   ${idx + 1}. "${result.question}" → ${result.error}`);
      });
    }

    console.log(`\n💡 RECOMMANDATIONS:`);
    if (this.results.coherentResponses / this.results.totalQuestions > 0.8) {
      console.log(`   ✅ Excellent! L'IA maîtrise bien la base de connaissances.`);
    } else if (this.results.coherentResponses / this.results.totalQuestions > 0.6) {
      console.log(`   ⚠️  Bon niveau, mais certaines réponses peuvent être améliorées.`);
    } else {
      console.log(`   🔧 Améliorations nécessaires pour les réponses incohérentes.`);
    }

    console.log(`\n📝 PROCHAINES ÉTAPES:`);
    console.log(`   1. Analyser les réponses incohérentes`);
    console.log(`   2. Ajuster le prompt contextuel`);
    console.log(`   3. Ajouter des exemples spécifiques`);
    console.log(`   4. Retester avec les améliorations`);
  }
}

// Exécution du test
async function main() {
  const tester = new AIKnowledgeTester();
  await tester.runFullTest();
}

main().catch(console.error);
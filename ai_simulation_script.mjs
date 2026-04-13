/**
 * SCRIPT DE SIMULATION ROBUSTE POUR L'IA MISSION SAGE
 * Teste plusieurs scénarios et simule les réponses IA pour analyse
 */

// Mock du service MissionSage pour simulation
class MockMissionSageService {
  static instance = null;

  static getInstance() {
    if (!MockMissionSageService.instance) {
      MockMissionSageService.instance = new MockMissionSageService();
    }
    return MockMissionSageService.instance;
  }

  async processQuery(query, user, state) {
    // Simulation des réponses basée sur le type de requête
    const lowerQuery = query.toLowerCase();
    let response = '';
    let engine = 'RULES';

    // Logique de simulation simplifiée
    if (lowerQuery.includes('branchement') || lowerQuery.includes('senelec')) {
      response = 'Selon la norme NS 01-001, le branchement Senelec doit respecter le coffret en limite de propriété avec hublot à 1.60m et câble enterré à 0.5m sous grillage rouge.';
      engine = 'RULES';
    } else if (lowerQuery.includes('indemnité') || lowerQuery.includes('coût')) {
      response = 'Les indemnités de mission incluent le matériel électrique, la main-d\'œuvre spécialisée, la logistique terrain et le barème PROQUELEC. La validation nécessite la certification DG.';
      engine = 'RULES';
    } else if (lowerQuery.includes('mission') || lowerQuery.includes('om')) {
      response = 'Pour créer une mission OM dans GEM-MINT : 1) Saisir les données projet, 2) Validation par Chef de Projet, 3) Certification par DG, 4) Calcul automatique des indemnités.';
      engine = 'CLAUDE';
    } else if (lowerQuery.includes('sécurité') || lowerQuery.includes('ddr')) {
      response = 'La sécurité électrique en BT ≤ 1000V impose : DDR obligatoire, prise terre PE vert/jaune, protections mécaniques PVC, et absence de fils visibles.';
      engine = 'RULES';
    } else if (lowerQuery.includes('kobo') || lowerQuery.includes('synchronisation')) {
      response = 'La synchronisation Kobo utilise le numeroordre comme clé unique. Les données terrain sont collectées via formulaire mobile et intégrées automatiquement dans GEM-MINT.';
      engine = 'RULES';
    } else {
      response = 'Question technique spécialisée. Veuillez consulter la norme NS 01-001 ou contacter le service technique PROQUELEC.';
      engine = 'RULES_FALLBACK';
    }

    // Simulation de délai de réponse
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      message: response,
      type: 'info',
      _engine: engine
    };
  }
}

// Scénarios de test (réduits pour démonstration)
const TEST_SCENARIOS = [
  // Scénarios Techniques (2 exemples seulement)
  {
    category: 'technical',
    queries: [
      'Comment installer un branchement Senelec selon la norme NS 01-001?',
      'Quelles sont les anomalies à éviter lors d\'une installation électrique?'
    ]
  },

  // Scénarios Financiers (2 exemples)
  {
    category: 'financial',
    queries: [
      'Comment calculer les indemnités de mission pour une équipe de 5 personnes?',
      'Quels sont les éléments inclus dans le calcul des coûts de mission?'
    ]
  }
];

// Utilisateurs de test avec différents rôles (réduits)
const TEST_USERS = [
  { role: 'CHEF_EQUIPE', name: 'Chef Maçon', email: 'chef@proquelec.sn' },
  { role: 'DG_PROQUELEC', name: 'Directeur Général', email: 'dg@proquelec.sn' }
];

// État simulé pour les tests
const MOCK_STATE = {
  stats: {
    totalMissions: 1250,
    totalCertified: 1180,
    totalIndemnities: 45000000
  },
  households: [
    { id: '1', status: 'Contrôle conforme', region: 'Dakar', departement: 'Plateau' },
    { id: '2', status: 'Réseau', region: 'Thiès', departement: 'Thiès' }
  ],
  auditLogs: []
};

// Fonction d'évaluation de la réponse
function evaluateResponse(query, response, category) {
  let accuracy = 0.5;
  let relevance = 0.5;
  let completeness = 0.5;
  const feedback = [];

  // Évaluation basée sur des mots-clés et patterns
  const lowerQuery = query.toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Vérifications par catégorie
  if (category === 'technical') {
    if (lowerResponse.includes('ns 01-001') || lowerResponse.includes('norme')) accuracy += 0.2;
    if (lowerResponse.includes('sécurité') || lowerResponse.includes('protection')) relevance += 0.2;
    if (lowerResponse.includes('câble') || lowerResponse.includes('coffret')) completeness += 0.2;
  }

  if (category === 'financial') {
    if (lowerResponse.includes('indemnité') || lowerResponse.includes('coût')) accuracy += 0.2;
    if (lowerResponse.includes('matériel') || lowerResponse.includes('main-d\'œuvre')) relevance += 0.2;
    if (lowerResponse.includes('validation') || lowerResponse.includes('dg')) completeness += 0.2;
  }

  if (category === 'process') {
    if (lowerResponse.includes('mission') || lowerResponse.includes('om')) accuracy += 0.2;
    if (lowerResponse.includes('validation') || lowerResponse.includes('chef')) relevance += 0.2;
    if (lowerResponse.includes('kobo') || lowerResponse.includes('synchronisation')) completeness += 0.2;
  }

  if (category === 'security') {
    if (lowerResponse.includes('sécurité') || lowerResponse.includes('ddr')) accuracy += 0.2;
    if (lowerResponse.includes('protection') || lowerResponse.includes('risque')) relevance += 0.2;
    if (lowerResponse.includes('bt') || lowerResponse.includes('1000v')) completeness += 0.2;
  }

  // Vérifications générales
  if (response.length < 50) {
    completeness -= 0.2;
    feedback.push('Réponse trop courte');
  }
  if (response.includes('?') || response.includes('reformulez')) {
    accuracy -= 0.3;
    feedback.push('Réponse évasive ou demande de reformulation');
  }
  if (lowerResponse.includes('proquelec') || lowerResponse.includes('gem-mint')) {
    relevance += 0.1;
  }

  // Clamp values
  accuracy = Math.max(0, Math.min(1, accuracy));
  relevance = Math.max(0, Math.min(1, relevance));
  completeness = Math.max(0, Math.min(1, completeness));

  return { accuracy, relevance, completeness, feedback };
}

// Fonction principale de simulation
async function runAISimulation() {
  console.log('🚀 DÉMARRAGE DE LA SIMULATION ROBUSTE DE L\'IA MISSION SAGE\n');

  const service = MockMissionSageService.getInstance();
  const results = [];
  const startTime = Date.now();

  // Test de tous les scénarios avec tous les rôles
  for (const scenario of TEST_SCENARIOS) {
    console.log(`📋 Test du scénario: ${scenario.category.toUpperCase()}`);

    for (const user of TEST_USERS) {
      for (const query of scenario.queries) {
        console.log(`  👤 ${user.role} → "${query.substring(0, 50)}..."`);

        const queryStart = Date.now();
        try {
          const response = await service.processQuery(query, user, MOCK_STATE);
          const responseTime = Date.now() - queryStart;

          const evaluation = evaluateResponse(query, response.message, scenario.category);
          const overallScore = (evaluation.accuracy + evaluation.relevance + evaluation.completeness) / 3;

          results.push({
            scenario: scenario.category,
            query,
            userRole: user.role,
            engine: response._engine || 'UNKNOWN',
            response: response.message,
            responseTime,
            ...evaluation,
            overallScore
          });

        } catch (error) {
          console.error(`  ❌ Erreur pour ${user.role}: ${error.message}`);
          results.push({
            scenario: scenario.category,
            query,
            userRole: user.role,
            engine: 'ERROR',
            response: `Erreur: ${error.message}`,
            responseTime: Date.now() - queryStart,
            accuracy: 0,
            relevance: 0,
            completeness: 0,
            overallScore: 0,
            feedback: ['Erreur système']
          });
        }
      }
    }
  }

  // Calcul des métriques de performance
  const metrics = calculatePerformanceMetrics(results);

  // Affichage des résultats
  displayResults(results, metrics);

  // Génération des recommandations d'amélioration
  const recommendations = generateRecommendations(results, metrics);

  // Sauvegarde des résultats
  saveResults(results, metrics, recommendations);

  console.log(`\n✅ Simulation terminée en ${Date.now() - startTime}ms`);
}

// Fonction de calcul des métriques
function calculatePerformanceMetrics(results) {
  const totalQueries = results.length;
  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const totalAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0);
  const totalRelevance = results.reduce((sum, r) => sum + r.relevance, 0);
  const totalCompleteness = results.reduce((sum, r) => sum + r.completeness, 0);
  const totalScore = results.reduce((sum, r) => sum + r.overallScore, 0);

  const engineUsage = {};
  const rolePerformance = {};
  const queryTypePerformance = {};

  results.forEach(result => {
    engineUsage[result.engine] = (engineUsage[result.engine] || 0) + 1;
    rolePerformance[result.userRole] = (rolePerformance[result.userRole] || 0) + result.overallScore;
    queryTypePerformance[result.scenario] = (queryTypePerformance[result.scenario] || 0) + result.overallScore;
  });

  // Moyennes
  Object.keys(rolePerformance).forEach(role => {
    rolePerformance[role] /= results.filter(r => r.userRole === role).length;
  });
  Object.keys(queryTypePerformance).forEach(type => {
    queryTypePerformance[type] /= results.filter(r => r.scenario === type).length;
  });

  return {
    totalQueries,
    averageResponseTime: totalResponseTime / totalQueries,
    averageAccuracy: totalAccuracy / totalQueries,
    averageRelevance: totalRelevance / totalQueries,
    averageCompleteness: totalCompleteness / totalQueries,
    overallAverageScore: totalScore / totalQueries,
    engineUsage,
    rolePerformance,
    queryTypePerformance
  };
}

// Fonction d'affichage des résultats
function displayResults(results, metrics) {
  console.log('\n📊 RÉSULTATS DE LA SIMULATION\n');

  console.log('MÉTRIQUES GLOBALES:');
  console.log(`  Total requêtes: ${metrics.totalQueries}`);
  console.log(`  Temps de réponse moyen: ${metrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`  Précision moyenne: ${(metrics.averageAccuracy * 100).toFixed(1)}%`);
  console.log(`  Pertinence moyenne: ${(metrics.averageRelevance * 100).toFixed(1)}%`);
  console.log(`  Complétude moyenne: ${(metrics.averageCompleteness * 100).toFixed(1)}%`);
  console.log(`  Score global moyen: ${(metrics.overallAverageScore * 100).toFixed(1)}%`);

  console.log('\nUTILISATION DES MOTEURS:');
  Object.entries(metrics.engineUsage).forEach(([engine, count]) => {
    console.log(`  ${engine}: ${count} requêtes (${((count / metrics.totalQueries) * 100).toFixed(1)}%)`);
  });

  console.log('\nPERFORMANCE PAR RÔLE:');
  Object.entries(metrics.rolePerformance).forEach(([role, score]) => {
    console.log(`  ${role}: ${(score * 100).toFixed(1)}%`);
  });

  console.log('\nPERFORMANCE PAR TYPE DE REQUÊTE:');
  Object.entries(metrics.queryTypePerformance).forEach(([type, score]) => {
    console.log(`  ${type}: ${(score * 100).toFixed(1)}%`);
  });

  // Affichage des pires performances
  console.log('\n🔴 REQUÊTES LES MOINS PERFORMANTES:');
  const worstResults = results
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, 5);

  worstResults.forEach((result, index) => {
    console.log(`  ${index + 1}. Score: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`     Rôle: ${result.userRole}, Scénario: ${result.scenario}`);
    console.log(`     Requête: "${result.query.substring(0, 60)}..."`);
    if (result.feedback.length > 0) {
      console.log(`     Feedback: ${result.feedback.join(', ')}`);
    }
    console.log('');
  });
}

// Fonction de génération des recommandations
function generateRecommendations(results, metrics) {
  const recommendations = [];

  // Analyse des moteurs
  const rulesUsage = metrics.engineUsage['RULES'] || 0;
  const claudeUsage = metrics.engineUsage['CLAUDE'] || 0;
  const fallbackUsage = (metrics.engineUsage['RULES_FALLBACK'] || 0) + (metrics.engineUsage['CLAUDE_FALLBACK'] || 0);

  if (fallbackUsage > metrics.totalQueries * 0.3) {
    recommendations.push('🔧 Augmenter la couverture des règles pour réduire les fallbacks (' + ((fallbackUsage / metrics.totalQueries) * 100).toFixed(1) + '% des cas)');
  }

  if (metrics.averageResponseTime > 2000) {
    recommendations.push('⚡ Optimiser les temps de réponse (moyenne: ' + metrics.averageResponseTime.toFixed(0) + 'ms)');
  }

  // Analyse par catégorie
  if (metrics.queryTypePerformance.technical < 0.7) {
    recommendations.push('📚 Améliorer les réponses techniques (score: ' + (metrics.queryTypePerformance.technical * 100).toFixed(1) + '%)');
  }

  if (metrics.queryTypePerformance.financial < 0.7) {
    recommendations.push('💰 Renforcer les réponses financières (score: ' + (metrics.queryTypePerformance.financial * 100).toFixed(1) + '%)');
  }

  if (metrics.queryTypePerformance.security < 0.7) {
    recommendations.push('🛡️ Améliorer les réponses sécurité (score: ' + (metrics.queryTypePerformance.security * 100).toFixed(1) + '%)');
  }

  // Recommandations spécifiques basées sur les erreurs
  const errorResults = results.filter(r => r.engine === 'ERROR');
  if (errorResults.length > 0) {
    recommendations.push('🐛 Corriger ' + errorResults.length + ' erreurs système détectées');
  }

  // Recommandations d'optimisation
  if (metrics.overallAverageScore < 0.8) {
    recommendations.push('🎯 Score global perfectible - envisager entraînement supplémentaire du modèle Claude');
  }

  return recommendations;
}

// Fonction de sauvegarde des résultats
function saveResults(results, metrics, recommendations) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ai_simulation_results_${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    metrics,
    recommendations,
    detailedResults: results.slice(0, 50) // Limiter pour la taille du fichier
  };

  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`💾 Résultats sauvegardés dans: ${filename}`);
}

// Fonction d'ajustement automatique de la configuration IA
async function autoTuneAI(metrics) {
  console.log('\n🔧 RECOMMANDATIONS D\'AJUSTEMENT DE L\'IA...\n');

  // Simulation d'ajustements basés sur les métriques
  if (metrics.averageAccuracy < 0.7) {
    console.log('📈 Amélioration recommandée : Augmenter la couverture des règles techniques');
  } else if (metrics.averageResponseTime > 1500) {
    console.log('⚡ Optimisation recommandée : Prioriser le moteur RULES pour la vitesse');
  } else {
    console.log('⚖️ Configuration optimale : Maintenir l\'équilibre RULES/CLAUDE');
  }

  console.log('✅ Analyse d\'ajustement terminée');
}

// Point d'entrée
console.log('Script chargé, test rapide...');

// Test rapide
const service = MockMissionSageService.getInstance();
console.log('Service mock créé');

// Normaliser les chemins pour Windows
const normalizePath = (path) => path.replace(/\\/g, '/').replace(/^file:\/+/, 'file:///');
const currentFile = normalizePath(import.meta.url);
const argvFile = normalizePath(`file://${process.argv[1]}`);

console.log('Normalized currentFile:', currentFile);
console.log('Normalized argvFile:', argvFile);
console.log('Are they equal?', currentFile === argvFile);

if (currentFile === argvFile) {
  console.log('Exécution directe détectée, lancement simulation...');
  runAISimulation()
    .then(() => {
      console.log('\n🎉 Simulation terminée avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur lors de la simulation:', error);
      process.exit(1);
    });
} else {
  console.log('Module importé, pas d\'exécution automatique');
}

export { runAISimulation, calculatePerformanceMetrics, generateRecommendations };
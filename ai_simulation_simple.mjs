/**
 * SCRIPT DE SIMULATION SIMPLIFIÉ POUR L'IA MISSION SAGE
 */

// Mock du service MissionSage
class MockMissionSageService {
  static instance = null;

  static getInstance() {
    if (!MockMissionSageService.instance) {
      MockMissionSageService.instance = new MockMissionSageService();
    }
    return MockMissionSageService.instance;
  }

  async processQuery(query, user, state) {
    const lowerQuery = query.toLowerCase();
    let response = '';
    let engine = 'RULES';

    if (lowerQuery.includes('branchement') || lowerQuery.includes('senelec')) {
      response = 'Selon la norme NS 01-001, le branchement Senelec doit respecter le coffret en limite de propriété avec hublot à 1.60m.';
      engine = 'RULES';
    } else if (lowerQuery.includes('indemnité') || lowerQuery.includes('coût')) {
      response = 'Les indemnités incluent le matériel, la main-d\'œuvre et la logistique. Validation requise par DG.';
      engine = 'RULES';
    } else {
      response = 'Question spécialisée. Consultez la norme NS 01-001.';
      engine = 'RULES_FALLBACK';
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    return { message: response, type: 'info', _engine: engine };
  }
}

// Scénarios simplifiés
const TEST_SCENARIOS = [
  {
    category: 'technical',
    queries: [
      'Comment installer un branchement Senelec?',
      'Quelles anomalies éviter?'
    ]
  },
  {
    category: 'financial',
    queries: [
      'Comment calculer les indemnités?',
      'Éléments du coût de mission?'
    ]
  }
];

const TEST_USERS = [
  { role: 'CHEF_EQUIPE', name: 'Chef Équipe' },
  { role: 'DG_PROQUELEC', name: 'DG' }
];

// Fonction d'évaluation
function evaluateResponse(query, response, category) {
  let accuracy = 0.5;
  let relevance = 0.5;
  let completeness = 0.5;

  const lowerResponse = response.toLowerCase();

  if (category === 'technical') {
    if (lowerResponse.includes('ns 01-001') || lowerResponse.includes('norme')) accuracy += 0.3;
    if (lowerResponse.includes('sécurité') || lowerResponse.includes('coffret')) relevance += 0.3;
  }

  if (category === 'financial') {
    if (lowerResponse.includes('indemnité') || lowerResponse.includes('coût')) accuracy += 0.3;
    if (lowerResponse.includes('matériel') || lowerResponse.includes('dg')) relevance += 0.3;
  }

  return { accuracy, relevance, completeness };
}

// Simulation principale
async function runAISimulation() {
  console.log('🚀 SIMULATION IA MISSION SAGE (VERSION SIMPLIFIÉE)\n');

  const service = MockMissionSageService.getInstance();
  const results = [];
  const startTime = Date.now();

  for (const scenario of TEST_SCENARIOS) {
    console.log(`📋 Test: ${scenario.category.toUpperCase()}`);

    for (const user of TEST_USERS) {
      for (const query of scenario.queries) {
        console.log(`  👤 ${user.role} → "${query}"`);

        const queryStart = Date.now();
        const response = await service.processQuery(query, user, {});
        const responseTime = Date.now() - queryStart;

        const evaluation = evaluateResponse(query, response.message, scenario.category);
        const overallScore = (evaluation.accuracy + evaluation.relevance + evaluation.completeness) / 3;

        results.push({
          scenario: scenario.category,
          userRole: user.role,
          engine: response._engine,
          responseTime,
          overallScore,
          response: response.message
        });
      }
    }
  }

  // Calcul des métriques
  const totalQueries = results.length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalQueries;
  const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / totalQueries;

  const engineUsage = {};
  results.forEach(r => {
    engineUsage[r.engine] = (engineUsage[r.engine] || 0) + 1;
  });

  // Affichage des résultats
  console.log('\n📊 RÉSULTATS DE LA SIMULATION\n');
  console.log(`Total requêtes: ${totalQueries}`);
  console.log(`Temps de réponse moyen: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`Score moyen: ${(avgScore * 100).toFixed(1)}%`);

  console.log('\nUtilisation des moteurs:');
  Object.entries(engineUsage).forEach(([engine, count]) => {
    console.log(`  ${engine}: ${count} (${((count / totalQueries) * 100).toFixed(1)}%)`);
  });

  // Recommandations
  console.log('\n🔧 RECOMMANDATIONS:');
  if (avgScore < 0.7) {
    console.log('  - Améliorer la précision des réponses techniques');
  }
  if (avgResponseTime > 1000) {
    console.log('  - Optimiser les temps de réponse');
  }
  if (engineUsage['RULES_FALLBACK'] > totalQueries * 0.3) {
    console.log('  - Étendre la couverture des règles');
  }

  console.log(`\n✅ Simulation terminée en ${Date.now() - startTime}ms`);
}

// Exécution
runAISimulation().catch(console.error);
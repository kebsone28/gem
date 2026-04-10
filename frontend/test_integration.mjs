import { MissionSageService, AIEngineConfig } from './src/index.js';

async function testIntegration() {
  console.log('=== Test d\'intégration MissionSage ===\n');

  // Configuration
  console.log('Configuration actuelle:', AIEngineConfig.getProvider());
  console.log('Est configuré:', AIEngineConfig.isConfigured());

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

  // Test du service
  const sageService = MissionSageService.getInstance();

  const testQueries = [
    'Quelles sont les normes pour un branchement Senelec?',
    'Comment créer une mission OM?',
    'Expliquez la différence entre partie active et masse'
  ];

  for (const query of testQueries) {
    console.log(`\n--- Test: "${query}" ---`);
    try {
      const response = await sageService.processQuery(query, mockUser, mockState);
      console.log('✅ Réponse reçue');
      console.log('Aperçu:', response.substring(0, 150) + '...');
    } catch (error) {
      console.log('❌ Erreur:', error.message);
    }
  }

  console.log('\n=== Test terminé ===');
}

testIntegration();
// Test script for MissionSageService improvements
import { MissionSageService } from './src/services/ai/MissionSageService.ts';

async function testQueries() {
  const service = MissionSageService.getInstance();

  const testCases = [
    { query: 'mes missions', user: { role: 'CHEF_EQUIPE', name: 'Test' } },
    { query: 'budget', user: { role: 'DG_PROQUELEC', name: 'DG' } },
    { query: 'cahier de charge', user: { role: 'CHEF_EQUIPE', name: 'Test' } },
    { query: 'comment valider une mission', user: { role: 'CHEF_EQUIPE', name: 'Test' } },
  ];

  const state = {
    stats: { totalMissions: 1250, totalCertified: 1180, totalIndemnities: 45000000 },
    households: [],
    auditLogs: []
  };

  for (const test of testCases) {
    console.log(`\nTesting: "${test.query}" as ${test.user.role}`);
    try {
      const response = await service.processQuery(test.query, test.user, state);
      console.log(`Response: ${response.message.substring(0, 200)}...`);
      console.log(`Engine: ${response._engine}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

testQueries().catch(console.error);
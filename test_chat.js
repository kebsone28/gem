import { missionSageService } from './frontend/src/services/ai/MissionSageService.js';

// Test data
const mockUser = {
  email: 'test@example.com',
  role: 'ADMIN_PROQUELEC',
  displayName: 'Test User'
};

const mockState = {
  stats: {
    totalMissions: 10,
    totalCertified: 5,
    totalIndemnities: 1000000,
    totalHouseholds: 100
  },
  auditLogs: [],
  households: []
};

async function testQuery(query) {
  console.log(`\n=== Testing: "${query}" ===`);
  try {
    const result = await missionSageService.processQuery(query, mockUser, mockState);
    console.log('Response:', result.message);
    console.log('Type:', result.type);
    console.log('Engine:', result._engine);
    if (result.smartReplies) {
      console.log('Smart Replies:', result.smartReplies.slice(0, 3));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  const testQueries = [
    'salam',
    'bonjour',
    'mission',
    'budget',
    'kobo',
    'norme',
    'aide',
    'comment créer une mission',
    'quelles sont les règles pour un branchement',
    'audit financier',
    'statistiques',
    'hello',
    'merci'
  ];

  for (const query of testQueries) {
    await testQuery(query);
  }
}

runTests().catch(console.error);
import { missionSageService } from '../src/services/ai/MissionSageService.ts';

// Stub browser storage for Node runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

const mockUser = {
  email: 'test@gem-mint.local',
  role: 'ADMIN_PROQUELEC',
  displayName: 'Admin proquelec',
};

const mockState = {
  stats: {
    totalMissions: 50,
    totalCertified: 40,
    totalIndemnities: 2000000,
  },
  households: [],
  auditLogs: [],
};

const queries = [
  'bonjour',
  'cahier de charge',
  'cahier des charges',
  'contrat d execution',
  'comment creer une mission',
  'mes missions',
  'budget',
  'kobo',
  'tableau de bord',
  'norme ns 01-001',
  'branchement senelec',
  'anomalie cable visible',
  'installation interieure',
  'simuler cout branchement',
  'rapport dg',
  'menu',
  'comment valider une mission',
  'stock materiel',
  'bug',
  'kobo mapping',
  'mon role',
  'protection ddr',
  'barrette terre exterieur',
  'liaison equipotentielle',
  'fils visibles',
  'poteaux bois pourris',
];

async function run() {
  console.log('=== AI SERVICE TEST ===');
  for (const query of queries) {
    const response = await missionSageService.processQuery(query, mockUser, mockState as any);
    console.log('\n---');
    console.log('Query:', query);
    console.log('Engine:', response._engine);
    console.log('Type:', response.type);
    console.log('Message:', response.message.replace(/\n/g, ' | '));
    if (response.smartReplies) {
      console.log('Smart Replies:', response.smartReplies.join(' | '));
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

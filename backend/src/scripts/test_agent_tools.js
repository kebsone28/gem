import { agentTools } from '../modules/assistant/agent/agentTools.js';

async function testReportGeneration() {
  const context = {
    organizationName: 'PROQUELEC',
    projectId: 'ebf916c3-942d-47c2-ad7d-fcbbbc2bd2e0'
  };

  console.log('📊 Testing Agent Report Generation...');

  const input = {
    title: 'Rapport d\'Audit Électrique - Zone Nord',
    summary: 'Analyse des installations basse tension pour le projet GEM SAAS.',
    items: [
      { id: 'H001', status: 'Conforme', observations: 'Prise de terre OK' },
      { id: 'H002', status: 'Non-Conforme', observations: 'Absence de DDR 30mA' }
    ]
  };

  const result = await agentTools.createReport(input, context);
  
  console.log('\n--- RESULT ---');
  console.log(result);

  if (result.includes('Rapport créé: Rapport d\'Audit Électrique - Zone Nord')) {
    console.log('\n✅ SUCCESS: Report generated with custom title.');
  }

  // Simulation d'une analyse de consommation
  console.log('\n🔍 Testing Consumption Analysis Tool...');
  const consumptionInput = {
    data: [
      { id: 'H001', consumption: 150, threshold: 100 },
      { id: 'H002', consumption: 80, threshold: 100 }
    ]
  };

  const analysis = await agentTools.analyzeConsumption(consumptionInput, context);
  console.log('Analysis Result:', analysis);

  if (analysis.includes('Anomalie détectée for H001')) {
    console.log('✅ SUCCESS: Anomalies correctly identified.');
  }
}

testReportGeneration();

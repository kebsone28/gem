import prisma from '../core/utils/prisma.js';
import { assistantService } from '../modules/assistant/assistant.service.js';

async function demoTechAgent() {
  const projectId = 'ebf916c3-942d-47c2-ad7d-fcbbbc2bd2e0';
  
  console.log('🚀 --- DÉMONSTRATION TECH AGENT (GEM SAAS) ---');
  console.log('Simulation d\'une demande d\'expertise complexe sur site...');

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true }
    });

    if (!project) return;

    const user = {
      id: '1c300e86-3919-4d5b-a85e-2f2bb39fcdd2',
      email: 'expert@proquelec.sn',
      organizationId: project.organizationId,
      organizationName: project.organization.name,
      projectSector: project.config?.sector || 'elec_bt',
      role: 'TECH_LEAD'
    };

    // Scénario : Un technicien demande une vérification de conformité pour un bâtiment spécifique
    const query = `Analyse la conformité technique du branchement H001. La valeur de la prise de terre est de 45 ohms et nous sommes en régime TT. Est-ce conforme à la norme NS 01-001 de PROQUELEC ? Si non, génère un rapport d'audit avec les mesures correctives.`;
    
    console.log(`\n👨‍🔧 Technicien: "${query}"`);
    console.log('🤖 L\'IA analyse l\'intention et active le TechAgent...');

    const result = await assistantService.processQuery({
      user,
      userId: user.id,
      message: query,
      context: { projectId: project.id, householdId: 'H001' },
      offlineMode: false
    });

    console.log('\n--- RÉPONSE DU TECH AGENT ---');
    console.log(result.response);
    console.log('\n📊 MÉTRIQUES D\'EXÉCUTION :');
    console.log(`- Intention : ${result.intent}`);
    console.log(`- Agent : ${result.agent}`);
    console.log(`- Source : ${result.source}`);
    console.log(`- Latence : ${result.latencyMs}ms`);

    if (result.source === 'agent') {
      console.log('\n✅ SUCCÈS : L\'agent a pu planifier et exécuter les outils d\'audit.');
    } else {
      console.log('\n⚠️ FALLBACK : Le moteur Ollama local n\'est pas encore joignable, le système a utilisé le mode de sécurité.');
    }

  } catch (error) {
    console.error('❌ Erreur démo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

demoTechAgent();

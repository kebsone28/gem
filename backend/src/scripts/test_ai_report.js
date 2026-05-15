import { buildSystemPrompt } from '../core/config/ai_registry.js';
import prisma from '../core/utils/prisma.js';
import { assistantService } from '../modules/assistant/assistant.service.js';

async function testAIIdentity() {
  const projectId = 'ebf916c3-942d-47c2-ad7d-fcbbbc2bd2e0';
  
  console.log(`🔍 Testing AI Identity with OLLAMA for Project ID: ${projectId}`);

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true }
    });

    if (!project) return;

    const organizationName = project.organization.name;
    const projectSector = project.config?.sector || 'elec_bt';

    const user = {
      id: '1c300e86-3919-4d5b-a85e-2f2bb39fcdd2',
      email: 'maçongem',
      organizationId: project.organizationId,
      organizationName: organizationName,
      projectSector: projectSector,
      role: 'ADMIN'
    };

    // No greeting, purely technical and long to force LLM
    const query = `Explique-moi les spécificités de la norme NS 01-001 pour les installations basse tension au Sénégal, en insistant sur le régime de neutre TT. Cette demande est faite dans le cadre du projet de ${organizationName}. Je veux une réponse technique exhaustive et conforme aux standards NF C 18-510 de notre entreprise.`;
    
    console.log(`User: "${query}"`);
    
    const result = await assistantService.processQuery({
      user,
      userId: user.id,
      message: query,
      context: { projectId: project.id },
      offlineMode: false
    });

    console.log('\n--- ASSISTANT RESPONSE ---');
    console.log(result.response);
    console.log(`(Source: ${result.source}, Latency: ${result.latencyMs}ms)`);

  } catch (error) {
    console.error('❌ Error during AI test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAIIdentity();

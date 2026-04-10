import { PrismaClient } from '@prisma/client';
import { recalculateProjectGrappes } from './src/services/project_config.service.js';

const prisma = new PrismaClient();

async function regenerateGrappes() {
  try {
    console.log('=== RÉGÉNÉRATION DES GRAPPES ===\n');

    // Get the first project
    const project = await prisma.project.findFirst({
      select: { id: true, name: true, organizationId: true }
    });

    if (!project) {
      console.error('❌ Aucun projet trouvé');
      return;
    }

    console.log(`📦 Projet trouvé: ${project.name} (${project.id})\n`);

    // Regenerate grappes
    const stats = await recalculateProjectGrappes(project.id, project.organizationId);
    
    console.log('✅ Grappes régénérées !\n');
    
    // Show statistics
    const grappeCount = await prisma.grappe.count({
      where: { projectId: project.id }
    });

    const householdCount = await prisma.household.count({
      where: { deletedAt: null }
    });

    console.log(`📊 Statistiques après régénération:`);
    console.log(`  Grappes: ${grappeCount}`);
    console.log(`  Ménages: ${householdCount}`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateGrappes();

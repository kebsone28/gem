import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBordeauEndpoint() {
  try {
    console.log('🧪 TEST: Simulation de /projects/{id}/bordereau\n');

    // Get first project
    const project = await prisma.project.findFirst({
      where: { deletedAt: null }
    });

    if (!project) {
      console.error('❌ Aucun projet trouvé');
      return;
    }

    console.log(`Projet testé: ${project.name} (${project.id})\n`);

    // Fetch exactly what the endpoint does
    const regions = await prisma.region.findMany({
      include: {
        grappes: {
          where: { organizationId: project.organizationId },
          include: {
            households: {
              where: {
                deletedAt: null,
                organizationId: project.organizationId,
                zone: { projectId: project.id }
              },
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    let enriched = [];
    for (const reg of regions) {
      for (const g of reg.grappes) {
        if (g.households.length === 0) continue;
        enriched.push({
          name: g.name,
          region: reg.name,
          householdCount: g.households.length
        });
      }
    }

    console.log(`📊 Résultat de l'endpoint:`);
    console.log(`   Grappes retournées: ${enriched.length}`);
    console.log(`   Total ménages: ${enriched.reduce((sum, g) => sum + g.householdCount, 0)}`);
    
    if (enriched.length === 0) {
      console.log(`\n✅ L'API retours une liste VIDE (Total Ménages: 0)`);
    }

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBordeauEndpoint();

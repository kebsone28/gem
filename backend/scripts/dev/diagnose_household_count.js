import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  try {
    console.log('=== DIAGNOSTIC: Comptage des Ménages ===\n');

    // 1. Nombre total de ménages NOT DELETED
    const totalHouseholds = await prisma.household.count({
      where: { deletedAt: null }
    });
    console.log(`1. Nombre total de ménages (non supprimés): ${totalHouseholds}`);

    // 2. Nombre par projet
    const projects = await prisma.project.findMany({
      select: { id: true, name: true }
    });

    for (const project of projects) {
      const projectHouseHolds = await prisma.household.count({
        where: {
          deletedAt: null,
          zone: { projectId: project.id }
        }
      });
      console.log(`   - Projet "${project.name}" (${project.id}): ${projectHouseHolds}`);
    }

    // 3. Vérifier les doublons par ID
    const duplicateIds = await prisma.household.groupBy({
      by: ['id'],
      having: {
        id: { _count: { gt: 1 } }
      },
      _count: { id: true }
    });
    console.log(`\n2. Ménages avec IDs dupliqués: ${duplicateIds.length}`);
    if (duplicateIds.length > 0) {
      console.log('   Exemples:', duplicateIds.slice(0, 5));
    }

    // 4. Vérifier la chaîne grappes → ménages
    const regions = await prisma.region.findMany({
      include: {
        grappes: {
          include: {
            _count: { select: { households: true } }
          }
        }
      }
    });

    console.log(`\n3. Comptage par Grappe:`);
    let totalInGrappes = 0;
    for (const region of regions) {
      console.log(`   Région: ${region.name}`);
      for (const grappe of region.grappes) {
        console.log(`     - ${grappe.name}: ${grappe._count.households} ménages`);
        totalInGrappes += grappe._count.households;
      }
    }
    console.log(`   TOTAL dans les grappes: ${totalInGrappes}`);

    // 5. Ménages sans grappe
    const unclassified = await prisma.household.count({
      where: { grappeId: null, deletedAt: null }
    });
    console.log(`\n4. Ménages sans grappe (non classés): ${unclassified}`);

    console.log(`\n5. Récapitulatif:`);
    console.log(`   - Total ménages: ${totalHouseholds}`);
    console.log(`   - Dans les grappes: ${totalInGrappes}`);
    console.log(`   - Non classés: ${unclassified}`);
    console.log(`   - Total grappes + non classés: ${totalInGrappes + unclassified}`);
    console.log(`   - Divergence: ${totalHouseholds - (totalInGrappes + unclassified)}`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();

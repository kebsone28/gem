import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAllDuplicates() {
  try {
    console.log('=== NETTOYAGE: SUPPRESSION DES DOUBLONS ===\n');
    
    // Trouver TOUS les ménages groupés par nom, région et village
    const potentialDuplicates = await prisma.household.groupBy({
      by: ['name', 'region', 'village'],
      where: { deletedAt: null },
      having: {
        id: { _count: { gt: 1 } }
      },
      _count: { id: true }
    });

    console.log(`Trouvé ${potentialDuplicates.length} groupes de doublons\n`);

    let totalDeleted = 0;

    // Pour chaque groupe de doublons
    for (const dup of potentialDuplicates) {
      const households = await prisma.household.findMany({
        where: {
          name: dup.name,
          region: dup.region,
          village: dup.village,
          deletedAt: null
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }  // Garder le plus récent
      });

      // Garder le premier (le plus récent), supprimer les autres
      const toDelete = households.slice(1).map(h => h.id);

      if (toDelete.length > 0) {
        // Soft delete (marquer avec deletedAt)
        await prisma.household.updateMany({
          where: { id: { in: toDelete } },
          data: { deletedAt: new Date() }
        });

        totalDeleted += toDelete.length;

        if (potentialDuplicates.indexOf(dup) < 5) {
          console.log(`✓ Supprimé ${toDelete.length} doublons pour: "${dup.name}" (${dup.region}/${dup.village})`);
        }
      }
    }

    console.log(`\n✓ NETTOYAGE TERMINÉ`);
    console.log(`   Total supprimé: ${totalDeleted}`);
    console.log(`   Avant: 10,879 ménages`);
    console.log(`   Après: ${10879 - totalDeleted} ménages (attendu: ~3,536)\n`);

    // Vérifier le résultat
    const finalCount = await prisma.household.count({
      where: { deletedAt: null }
    });
    console.log(`Vérification: ${finalCount} ménages restants`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllDuplicates();

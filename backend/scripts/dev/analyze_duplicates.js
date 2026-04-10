import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateHouseholds() {
  try {
    console.log('=== NETTOYAGE DES MÉNAGES DUPLIQUÉS ===\n');
    
    // 1. Trouver les ménages groupés par nom, région et village (potentiels doublons)
    const potentialDuplicates = await prisma.household.groupBy({
      by: ['name', 'region', 'village'],
      where: { deletedAt: null },
      having: {
        id: { _count: { gt: 1 } }
      },
      _count: { id: true }
    });

    console.log(`Ménages potentiellement dupliqués trouvés: ${potentialDuplicates.length}\n`);

    if (potentialDuplicates.length > 0) {
      let totalToDelete = 0;

      // Pour chaque groupe de doublons
      for (const dup of potentialDuplicates.slice(0, 5)) {
        const households = await prisma.household.findMany({
          where: {
            name: dup.name,
            region: dup.region,
            village: dup.village,
            deletedAt: null
          },
          select: { id: true, updatedAt: true, grappeId: true },
          orderBy: { updatedAt: 'desc' }
        });

        console.log(`\nDupliqué: ${dup.name} (${dup.region}/${dup.village}) - ${households.length} copies`);
        households.forEach((h, i) => {
          console.log(`  ${i === 0 ? '✓ GARDER' : '✗ SUPPRIMER'} ID: ${h.id}, Modifié: ${h.updatedAt.toISOString().split('T')[0]}, Grappe: ${h.grappeId}`);
          if (i > 0) totalToDelete++;
        });
      }

      console.log(`\n\nNOMBRE TOTAL À SUPPRIMER (dans top 5 doublons): ${totalToDelete}`);
      console.log('Si vous confirmez, exécutez le fix_cleanup.js');
    } else {
      console.log('\n✓ Aucun doublon détecté basé sur (nom, région, village)');
      console.log('Le problème vient probablement d\'une réimportation avec de NOUVEAUX IDs');
    }

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateHouseholds();

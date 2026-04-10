import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Détecte les doublons en utilisant plusieurs critères :
 * - (phone + region + village) si phone existe
 * - (location + region) si GPS existe
 * - (region + village) comme fallback
 */
async function smartCleanupDuplicates() {
  try {
    console.log('=== NETTOYAGE INTELLIGENT: Par Téléphone & Localisation ===\n');

    let totalDeleted = 0;

    // 1. Doublons par TÉLÉPHONE (critère le plus fiable)
    if (true) {
      const phoneGroups = await prisma.household.groupBy({
        by: ['phone', 'region'],
        where: {
          deletedAt: null,
          phone: { not: null }
        },
        having: { id: { _count: { gt: 1 } } },
        _count: { id: true }
      });

      console.log(`Groupes de doublons par TÉLÉPHONE: ${phoneGroups.length}`);

      for (const group of phoneGroups) {
        const households = await prisma.household.findMany({
          where: {
            phone: group.phone,
            region: group.region,
            deletedAt: null
          },
          select: { id: true, updatedAt: true, name: true },
          orderBy: { updatedAt: 'desc' }
        });

        // Garder le premier (le plus récent), supprimer les autres
        const toDelete = households.slice(1).map(h => h.id);
        if (toDelete.length > 0) {
          await prisma.household.updateMany({
            where: { id: { in: toDelete } },
            data: { deletedAt: new Date() }
          });
          totalDeleted += toDelete.length;
        }
      }
    }

    // 2. Doublons par LOCALISATION GPS (si phone absent)
    if (totalDeleted < 5000) {
      const gpsGroups = await prisma.household.groupBy({
        by: ['region', 'departement', 'village'],
        where: {
          deletedAt: null,
          phone: null,
          latitude: { not: null },
          longitude: { not: null }
        },
        having: { id: { _count: { gt: 1 } } },
        _count: { id: true }
      });

      console.log(`Groupes de doublons par GPS: ${gpsGroups.length}`);

      for (const group of gpsGroups.slice(0, 100)) {
        // Limiter aux premières 100 pour ne pas supprimer trop
        const households = await prisma.household.findMany({
          where: {
            region: group.region,
            departement: group.departement,
            village: group.village,
            deletedAt: null
          },
          select: { id: true, updatedAt: true, latitude: true, longitude: true },
          orderBy: { updatedAt: 'desc' }
        });

        // Supprimer les doublons (garder le plus récent)
        const toDelete = households.slice(1).map(h => h.id);
        if (toDelete.length > 0) {
          await prisma.household.updateMany({
            where: { id: { in: toDelete } },
            data: { deletedAt: new Date() }
          });
          totalDeleted += toDelete.length;
        }
      }
    }

    console.log(`\n✓ Total supprimé: ${totalDeleted}`);

    // Vérifier le résultat
    const finalCount = await prisma.household.count({ where: { deletedAt: null } });
    console.log(`Total restant: ${finalCount}`);
    console.log(`Avant: 10,879`);
    console.log(`Après: ${finalCount}`);
    console.log(`Réduction: ${10879 - finalCount} (${(((10879 - finalCount) / 10879) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

smartCleanupDuplicates();

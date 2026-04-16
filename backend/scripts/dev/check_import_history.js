import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImportHistory() {
  try {
    console.log('=== VÉRIFIER LES RÉIMPORTATIONS ===\n');

    // Compter par région
    const regionCounts = await prisma.household.groupBy({
      by: ['region'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log('Distribution par région:');
    regionCounts.forEach(rc => {
      console.log(`  ${rc.region}: ${rc._count.id}`);
    });

    // Vérifier les doublons par numero/identifiant
    const duplicates = await prisma.household.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, region: true, grappeId: true, updatedAt: true },
      take: 10
    });

    console.log('\nÉchantillons de ménages:');
    duplicates.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i + 1}. ID: ${h.id}, Nom: ${h.name}, Région: ${h.region}, Modifié: ${h.updatedAt.toISOString().split('T')[0]}`);
    });

    // Vérifier la distribution des IDs (Numériques ou UUID)
    const patterns = await prisma.household.findMany({
      where: {
        deletedAt: null
      },
      select: { id: true },
      take: 20
    });

    console.log('\nÉchantillons d\'IDs de ménages:');
    patterns.forEach(p => console.log(`  ${p.id}`));
    console.log(`  ... (total: ${await prisma.household.count({ where: { deletedAt: null } })})`);

    // Vérifier s'il y a des ménages avec le même numéro mais créés à des dates différentes
    const allIds = await prisma.household.findMany({
      where: { deletedAt: null },
      select: { id: true, createdAt: true }
    });

    const idGroups = {};
    allIds.forEach(h => {
      if (!idGroups[h.id]) idGroups[h.id] = [];
      idGroups[h.id].push(h.createdAt);
    });

    const potentialDupes = Object.entries(idGroups).filter(([_, dates]) => dates.length > 1);
    console.log(`\nMénages avec même ID mais créés à des dates différentes: ${potentialDupes.length}`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportHistory();

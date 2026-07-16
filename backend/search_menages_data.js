import prisma from './src/core/utils/prisma.js';

async function searchMenagesData() {
  try {
    console.log('=== Recherche de sources de données pour les ménages ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Vérifier toutes les tables qui pourraient contenir des données de ménages
    console.log('1. Table Household:');
    const householdCount = await prisma.household.count({
      where: { organizationId, deletedAt: null }
    });
    console.log(`   Total: ${householdCount} ménages`);

    console.log('\n2. Table GedcollectAssignment (données collectées mobile):');
    const gedcollectCount = await prisma.gedcollectAssignment.count({
      where: { organizationId }
    });
    console.log(`   Total: ${gedcollectCount} assignations`);

    console.log('\n3. Table ToolboxSubmission (soumissions de formulaires):');
    const toolboxCount = await prisma.toolboxSubmission.count({
      where: { organizationId }
    });
    console.log(`   Total: ${toolboxCount} soumissions`);

    console.log('\n4. Table MESRecord (enregistrements MES):');
    const mesCount = await prisma.mESRecord.count({
      where: { organizationId }
    });
    console.log(`   Total: ${mesCount} enregistrements`);

    console.log('\n5. Vérifier les données dans les villages:');
    const villagesData = await prisma.$queryRaw`
      SELECT COUNT(*) as count, "village" 
      FROM "Household" 
      WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL
      GROUP BY "village"
      ORDER BY count DESC
      LIMIT 10
    `;
    console.log('   Distribution par village:');
    villagesData.forEach(v => {
      console.log(`     ${v.village || 'Non défini'}: ${v.count} ménages`);
    });

    console.log('\n6. Vérifier les projets existants:');
    const projects = await prisma.project.findMany({
      where: { organizationId },
      select: { id: true, name: true, totalHouses: true }
    });
    console.log('   Projets:');
    projects.forEach(p => {
      console.log(`     ${p.name}: ${p.totalHouses} maisons prévues`);
    });

    console.log('\n7. Vérifier les données brutes (tous les ménages incluant supprimés):');
    const allHouseholds = await prisma.household.count({
      where: { organizationId }
    });
    console.log(`   Total (incluant supprimés): ${allHouseholds}`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchMenagesData();
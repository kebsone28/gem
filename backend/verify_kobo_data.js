import prisma from './src/core/utils/prisma.js';

console.log('\n📊 === DONNÉES KOBO EN BASE DE DONNÉES === \n');

// Get Kobo households
const households = await prisma.household.findMany({
  where: { source: 'Kobo' },
  select: {
    id: true,
    name: true,
    phone: true,
    region: true,
    latitude: true,
    longitude: true,
    status: true,
    koboSubmissionId: true,
    createdAt: true,
    source: true
  },
  orderBy: { createdAt: 'desc' }
});

console.log(`Total ménages Kobo: ${households.length}\n`);

if (households.length > 0) {
  households.forEach((h, i) => {
    console.log(`\n${i + 1}. ${h.name || '(pas de nom)'}`);
    console.log(`   - ID BD: ${h.id.substring(0, 8)}...`);
    console.log(`   - Kobo ID: ${h.koboSubmissionId}`);
    console.log(`   - Téléphone: ${h.phone || '(vide)'}`);
    console.log(`   - Région: ${h.region}`);
    console.log(`   - Coords: [${h.latitude}, ${h.longitude}]`);
    console.log(`   - Statut: ${h.status}`);
    console.log(`   - Créé: ${h.createdAt}`);
  });
} else {
  console.log('❌ Aucun ménage Kobo trouvé en BD');
}

// Count summary
const totalCount = await prisma.household.count();
const koboCount = await prisma.household.count({ where: { source: 'Kobo' } });
const manualCount = await prisma.household.count({ where: { source: { not: 'Kobo' } } });

console.log(`\n\n📈 RÉSUMÉ:`);
console.log(`  - Total ménages: ${totalCount}`);
console.log(`  - Ménages Kobo: ${koboCount}`);
console.log(`  - Ménages manuels: ${manualCount}`);

process.exit(0);

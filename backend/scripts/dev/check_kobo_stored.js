import prisma from './src/core/utils/prisma.js';

console.log('\n📊 === DONNÉES KOBO EN BASE DE DONNÉES ===\n');

try {
  // Get count first
  const koboCount = await prisma.household.count({ where: { source: 'Kobo' } });
  const totalCount = await prisma.household.count();
  
  console.log(`✅ Total ménages Kobo: ${koboCount}`);
  console.log(`   Total ménages en BD: ${totalCount}\n`);

  // Get Kobo households
  const households = await prisma.household.findMany({
    where: { source: 'Kobo' },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  if (households.length > 0) {
    households.forEach((h, i) => {
      console.log(`\n${i + 1}. Ménage Kobo`);
      console.log(`   - Nom: ${h.name || '(vide)'}`);
      console.log(`   - Téléphone: ${h.phone || '(vide)'}`);
      console.log(`   - Région: ${h.region}`);
      console.log(`   - Latitude: ${h.latitude}`);
      console.log(`   - Longitude: ${h.longitude}`);
      console.log(`   - Statut: ${h.status}`);
      console.log(`   - Source: ${h.source}`);
    });
  } else {
    console.log('Aucun ménage Kobo trouvé\n');
  }

} catch (err) {
  console.error('❌ Erreur:', err.message);
}

process.exit(0);

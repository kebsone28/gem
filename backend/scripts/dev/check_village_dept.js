import prisma from './src/core/utils/prisma.js';

console.log('\n📋 === VÉRIFICATION DES COLONNES village ET département ===\n');

try {
  // Check if columns exist in the Household table
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Household'
    AND column_name IN ('village', 'departement')
    ORDER BY column_name;
  `);

  console.log('✅ Colonnes trouvées dans la table Household:\n');
  result.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
    console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`);
  });

  // Check the data in Kobo households
  console.log('\n📊 Données dans les ménages Kobo:\n');
  const households = await prisma.household.findMany({
    where: { source: 'Kobo' },
    select: {
      name: true,
      phone: true,
      village: true,
      departement: true,
      region: true
    },
    take: 5
  });

  if (households.length > 0) {
    households.forEach((h, i) => {
      console.log(`${i + 1}. ${h.name}`);
      console.log(`   - village: ${h.village || '(NULL/vide)'}`);
      console.log(`   - departement: ${h.departement || '(NULL/vide)'}`);
      console.log(`   - region: ${h.region}\n`);
    });
  }

} catch (err) {
  console.error('❌ Erreur:', err.message);
}

process.exit(0);

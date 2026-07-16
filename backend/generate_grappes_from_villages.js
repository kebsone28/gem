import prisma from './src/core/utils/prisma.js';

async function generateGrappesFromVillages() {
  try {
    console.log('=== Génération automatique des grappes depuis les villages ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer les régions
    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true }
    });

    console.log(`Régions trouvées: ${regions.length}`);
    regions.forEach(r => console.log(`  - ${r.name} (${r.code})`));

    // Récupérer les villages depuis carto_villages
    const villages = await prisma.$queryRaw`
      SELECT region, village, n, lat, lon, defaultgrappe, x, y
      FROM carto_villages
      ORDER BY region, village
    `;

    console.log(`\nVillages trouvés: ${villages.length}`);

    // Grouper les villages par région
    const villagesByRegion = {};
    villages.forEach(v => {
      if (!villagesByRegion[v.region]) {
        villagesByRegion[v.region] = [];
      }
      villagesByRegion[v.region].push(v);
    });

    console.log('\nDistribution par région:');
    Object.keys(villagesByRegion).forEach(region => {
      console.log(`  - ${region}: ${villagesByRegion[region].length} villages`);
    });

    // Créer les grappes pour chaque région
    let totalGrappesCreated = 0;

    for (const region of regions) {
      const regionVillages = villagesByRegion[region.name] || [];
      if (regionVillages.length === 0) {
        console.log(`\n⚠️  Aucun village trouvé pour la région ${region.name}`);
        continue;
      }

      console.log(`\n🔄 Création des grappes pour ${region.name}...`);

      // Créer une grappe par village (ou utiliser le defaultgrappe si disponible)
      for (const village of regionVillages) {
        const grappeNumber = village.defaultgrappe || (village.n || 1);
        const grappeKey = `${region.code}_G${String(grappeNumber).padStart(3, '0')}`;
        const menageCount = village.n || 1;

        // Vérifier si la grappe existe déjà
        const existing = await prisma.cartoGrappe.findUnique({
          where: { organizationId_grappeKey: { organizationId, grappeKey } }
        });

        if (existing) {
          console.log(`  ⏭️  Grappe ${grappeKey} existe déjà (mise à jour du compteur)`);
          await prisma.cartoGrappe.update({
            where: { id: existing.id },
            data: { menageCount }
          });
        } else {
          console.log(`  ➕ Création grappe ${grappeKey} (${menageCount} ménages)`);
          await prisma.cartoGrappe.create({
            data: {
              organizationId,
              regionId: region.id,
              grappeNumber,
              grappeKey,
              menageCount,
              active: true
            }
          });
          totalGrappesCreated++;
        }
      }
    }

    console.log(`\n✅ Génération terminée: ${totalGrappesCreated} nouvelles grappes créées`);

    // Vérifier le résultat
    const finalGrappes = await prisma.cartoGrappe.findMany({
      where: { organizationId },
      include: { region: true },
      orderBy: [{ region: { name: 'asc' } }, { grappeNumber: 'asc' }]
    });

    console.log(`\n📊 Total grappes dans la base: ${finalGrappes.length}`);
    finalGrappes.forEach(g => {
      console.log(`  - ${g.grappeKey}: ${g.menageCount} ménages (${g.region?.name || 'Sans région'})`);
    });

  } catch (error) {
    console.error('Erreur lors de la génération des grappes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateGrappesFromVillages();
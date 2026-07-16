import prisma from './src/core/utils/prisma.js';

async function addKaffrineGrappe6() {
  try {
    console.log('=== Ajout d\'une 6ème grappe à Kaffrine ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer la région Kaffrine
    const kaffrineRegion = await prisma.cartoRegion.findFirst({
      where: { organizationId, code: 'KAF' }
    });

    if (!kaffrineRegion) {
      console.error('❌ Région Kaffrine non trouvée');
      return;
    }

    console.log(`Région Kaffrine trouvée: ${kaffrineRegion.name} (ID: ${kaffrineRegion.id})`);

    // Vérifier si KAF_G006 existe déjà
    const existingGrappe = await prisma.cartoGrappe.findUnique({
      where: { organizationId_grappeKey: { organizationId, grappeKey: 'KAF_G006' } }
    });

    if (existingGrappe) {
      console.log('⚠️  La grappe KAF_G006 existe déjà');
      console.log(`   Ménages actuels: ${existingGrappe.menageCount}`);
      
      // Demander si on veut mettre à jour le nombre de ménages
      const newMenageCount = 50; // Valeur par défaut
      
      await prisma.cartoGrappe.update({
        where: { id: existingGrappe.id },
        data: { menageCount: newMenageCount }
      });
      
      console.log(`✓ Grappe KAF_G006 mise à jour: ${newMenageCount} ménages`);
    } else {
      // Créer la nouvelle grappe
      const newGrappe = await prisma.cartoGrappe.create({
        data: {
          organizationId,
          regionId: kaffrineRegion.id,
          grappeNumber: 6,
          grappeKey: 'KAF_G006',
          menageCount: 50, // Valeur par défaut
          active: true
        }
      });

      console.log(`✓ Grappe KAF_G006 créée avec ${newGrappe.menageCount} ménages`);
    }

    // Vérifier toutes les grappes de Kaffrine
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId,
        regionId: kaffrineRegion.id,
        active: true
      },
      orderBy: { grappeNumber: 'asc' }
    });

    console.log(`\n📊 Total grappes à Kaffrine: ${kaffrineGrappes.length}`);
    kaffrineGrappes.forEach(g => {
      console.log(`  - ${g.grappeKey}: ${g.menageCount} ménages`);
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de la grappe:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addKaffrineGrappe6();
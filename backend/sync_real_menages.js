import prisma from './src/core/utils/prisma.js';

async function syncRealMenages() {
  try {
    console.log('=== Synchronisation des vrais ménages depuis Household vers CartoGrappe ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer toutes les régions Carto
    const cartoRegions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      include: {
        grappes: true
      }
    });

    console.log(`Régions trouvées: ${cartoRegions.length}\n`);

    // Récupérer tous les ménages actifs
    const households = await prisma.household.findMany({
      where: { 
        organizationId,
        deletedAt: null,
        grappeId: { not: null }
      },
      select: {
        id: true,
        grappeId: true,
        region: true,
        village: true
      }
    });

    console.log(`Ménages actifs avec grappe: ${households.length}\n`);

    // Grouper les ménages par grappe
    const menagesByGrappe = {};
    households.forEach(h => {
      if (h.grappeId) {
        if (!menagesByGrappe[h.grappeId]) {
          menagesByGrappe[h.grappeId] = [];
        }
        menagesByGrappe[h.grappeId].push(h);
      }
    });

    console.log(`Groupes de ménages par grappe: ${Object.keys(menagesByGrappe).length}\n`);

    // Pour chaque grappe Carto, compter les ménages correspondants
    for (const region of cartoRegions) {
      console.log(`--- Région: ${region.name} (${region.code}) ---`);
      
      for (const grappe of region.grappes) {
        // Trouver les ménages qui correspondent à cette grappe
        // On utilise une correspondance basée sur le nom de la grappe
        const grappeNamePattern = grappe.grappeKey.replace('KAF_', 'KAF').replace('TAM_', 'TAM');
        
        // Chercher les ménages qui ont un grappeId correspondant
        // ou utiliser une correspondance par région/village
        let count = 0;
        
        // Méthode 1: Si grappeId existe et correspond
        // (On va faire une correspondance approximative basée sur le nom de la grappe)
        
        // Méthode 2: Compter par région et correspondance de nom
        const regionName = region.name === 'Kaffrine' ? 'Kaffrine' : 
                          region.name === 'Tambacounda' ? 'Tambacounda' : region.name;
        
        const menagesInRegion = households.filter(h => h.region === regionName);
        
        // Distribuer les ménages proportionnellement entre les grappes de la région
        const totalGrappesInRegion = region.grappes.length;
        const menagesPerGrappe = Math.floor(menagesInRegion.length / totalGrappesInRegion);
        
        // Pour une distribution plus précise, on pourrait utiliser les villages
        // Pour l'instant, on fait une distribution simple
        count = menagesPerGrappe;
        
        // Mettre à jour le nombre de ménages dans CartoGrappe
        await prisma.cartoGrappe.update({
          where: { id: grappe.id },
          data: { menageCount: count }
        });
        
        console.log(`  ${grappe.grappeKey}: ${count} ménages (mis à jour)`);
      }
      
      const totalMenages = households.filter(h => {
        const regionName = region.name === 'Kaffrine' ? 'Kaffrine' : 
                          region.name === 'Tambacounda' ? 'Tambacounda' : region.name;
        return h.region === regionName;
      }).length;
      
      console.log(`  Total ménages région: ${totalMenages}\n`);
    }

    // Vérifier les résultats
    console.log('=== Vérification après synchronisation ===');
    const updatedRegions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      include: {
        grappes: true
      }
    });

    let grandTotal = 0;
    for (const region of updatedRegions) {
      console.log(`\n${region.name}:`);
      let regionTotal = 0;
      for (const grappe of region.grappes) {
        console.log(`  ${grappe.grappeKey}: ${grappe.menageCount} ménages`);
        regionTotal += grappe.menageCount;
      }
      console.log(`  Total: ${regionTotal} ménages`);
      grandTotal += regionTotal;
    }
    
    console.log(`\n📊 Grand total: ${grandTotal} ménages`);
    console.log(`📊 Total ménages dans Household: ${households.length}`);

  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncRealMenages();
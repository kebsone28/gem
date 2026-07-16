import prisma from './src/core/utils/prisma.js';

async function initializeCartoData() {
  try {
    console.log('=== Initialisation des données Carto par défaut ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Créer les régions par défaut
    const defaultRegions = [
      { name: 'Kaffrine', code: 'KAF', description: 'Région de Kaffrine' },
      { name: 'Tambacounda', code: 'TAM', description: 'Région de Tambacounda' }
    ];

    console.log('Création des régions par défaut...');
    for (const region of defaultRegions) {
      await prisma.cartoRegion.upsert({
        where: { organizationId_code: { organizationId, code: region.code } },
        update: { name: region.name, description: region.description, active: true },
        create: { 
          organizationId, 
          name: region.name, 
          code: region.code, 
          description: region.description,
          active: true 
        }
      });
      console.log(`  - ${region.name} créée/mise à jour`);
    }

    // Créer les lots par défaut
    const defaultLots = [
      { lotKey: 'A', title: 'Lot A - Pré-câblage et Kits de Distribution Intérieure', description: 'Production et installation de kits d\'installation intérieure' },
      { lotKey: 'B', title: 'Lot B - Installation Intérieure', description: 'Génie civil, installation intérieure et kits secondaires' },
      { lotKey: 'C', title: 'Lot C - Branchement', description: 'Tirage câble et branchements' }
    ];

    console.log('\nCréation des lots par défaut...');
    for (const lot of defaultLots) {
      await prisma.cartoLot.upsert({
        where: { organizationId_lotKey: { organizationId, lotKey: lot.lotKey } },
        update: { title: lot.title, description: lot.description, active: true },
        create: { 
          organizationId, 
          lotKey: lot.lotKey, 
          title: lot.title, 
          description: lot.description,
          active: true 
        }
      });
      console.log(`  - ${lot.title} créé/mis à jour`);
    }

    console.log('\n✅ Données par défaut initialisées avec succès !\n');

    // Vérifier les données créées
    const regions = await prisma.cartoRegion.findMany({ where: { organizationId } });
    const lots = await prisma.cartoLot.findMany({ where: { organizationId } });

    console.log('Résumé:');
    console.log(`  - ${regions.length} régions créées`);
    console.log(`  - ${lots.length} lots créés`);

  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeCartoData();
import prisma from './src/core/utils/prisma.js';

async function updateEntrepreneurGrappeKeys() {
  try {
    console.log('=== Mise à jour des clés de grappe des entrepreneurs ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer toutes les grappes
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    // Créer un mapping des anciennes clés vers les nouvelles (simple)
    const keyMapping = {
      // Kaffrine mappings - distribute evenly
      'Kaffrine_1': 'KAF_G001',
      'Kaffrine_2': 'KAF_G002',
      'Kaffrine_3': 'KAF_G003',
      'Kaffrine_4': 'KAF_G004',
      'Kaffrine_5': 'KAF_G005',
      'Kaffrine_6': 'KAF_G001', // Fallback
      
      // Tambacounda mappings
      'Tambacounda_1': 'TAM_G001',
      'Tambacounda_2': 'TAM_G002',
      'Tambacounda_3': 'TAM_G003',
      
      // Global assignments
      '__global': '__global'
    };

    console.log('Mapping des clés:');
    Object.entries(keyMapping).forEach(([oldKey, newKey]) => {
      console.log(`  ${oldKey} -> ${newKey}`);
    });

    // Récupérer tous les entrepreneurs
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId }
    });

    console.log(`\nEntrepreneurs à mettre à jour: ${entrepreneurs.length}`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const entrepreneur of entrepreneurs) {
      const oldKey = entrepreneur.grappeKey;
      
      // Si la clé existe dans le mapping, la mettre à jour
      if (oldKey && keyMapping[oldKey]) {
        const newKey = keyMapping[oldKey];
        
        // Vérifier si la nouvelle grappe existe
        const newGrappe = grappes.find(g => g.grappeKey === newKey);
        
        if (newGrappe) {
          await prisma.cartoEntrepreneur.update({
            where: { id: entrepreneur.id },
            data: { 
              grappeKey: newKey
            }
          });
          console.log(`✓ ${oldKey} -> ${newKey} (${entrepreneur.entreprise})`);
          updatedCount++;
        } else {
          console.log(`✗ ${newKey} n'existe pas pour ${oldKey} (${entrepreneur.entreprise})`);
          skippedCount++;
        }
      } else if (oldKey && oldKey.startsWith('group_grp_')) {
        // Ignorer les anciennes clés de groupe
        console.log(`⏭️  Ancienne clé de groupe ignorée: ${oldKey}`);
        skippedCount++;
      } else {
        console.log(`⏭️  Clé non reconnue: ${oldKey}`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Mise à jour terminée: ${updatedCount} entrepreneurs mis à jour, ${skippedCount} ignorés`);

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateEntrepreneurGrappeKeys();
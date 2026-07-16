import prisma from './src/core/utils/prisma.js';

async function updateEntrepreneursRealGrappes() {
  try {
    console.log('=== Mise à jour des entrepreneurs avec les vraies grappes ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer toutes les grappes actuelles
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    console.log(`Grappes disponibles: ${grappes.length}`);
    grappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages (${g.region.name})`);
    });

    // Supprimer tous les entrepreneurs existants
    console.log('\nSuppression des entrepreneurs existants...');
    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId }
    });
    console.log('✓ Entrepreneurs supprimés');

    // Créer de nouveaux entrepreneurs pour chaque grappe (Lot B uniquement)
    console.log('\nCréation des entrepreneurs pour Lot B:');
    
    const prestataires = [
      'Le Natangue Suarl',
      'Services Plus Senegal', 
      'TOP ENERGIE',
      'COTRAC',
      'Génie plus Senegal',
      'Général Service et synergie (CSS)',
      'Lebougui all works services (LAWS)',
      'Global service plus'
    ];

    for (let i = 0; i < grappes.length; i++) {
      const grappe = grappes[i];
      const prestataire = prestataires[i % prestataires.length];
      
      await prisma.cartoEntrepreneur.create({
        data: {
          organizationId,
          lot: 'B',
          grappeKey: grappe.grappeKey,
          mode: 'individuel',
          entreprise: prestataire,
          societe: prestataire
        }
      });

      console.log(`✓ ${prestataire} → ${grappe.grappeKey} (${grappe.menageCount} ménages)`);
    }

    // Vérifier les résultats
    console.log('\n=== Vérification ===');
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId }
    });

    console.log(`Total entrepreneurs créés: ${entrepreneurs.length}`);
    entrepreneurs.forEach(e => {
      console.log(`  ${e.entreprise} - Lot ${e.lot} - ${e.grappeKey}`);
    });

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateEntrepreneursRealGrappes();
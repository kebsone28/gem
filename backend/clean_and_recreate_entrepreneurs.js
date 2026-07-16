import prisma from './src/core/utils/prisma.js';

async function cleanAndRecreateEntrepreneurs() {
  try {
    console.log('=== Nettoyage et recréation des entrepreneurs ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Supprimer tous les entrepreneurs existants
    const deletedCount = await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId }
    });
    console.log(`✓ ${deletedCount} entrepreneurs supprimés`);

    // Récupérer toutes les grappes
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    console.log(`Grappes disponibles: ${grappes.length}`);

    // Recréer uniquement les entrepreneurs du Lot B avec des clés uniques
    const lotBEntrepreneurs = [
      { grappeKey: 'KAF_G001', entreprise: 'Le Natangue Suarl' },
      { grappeKey: 'KAF_G002', entreprise: 'Services Plus Senegal' },
      { grappeKey: 'KAF_G003', entreprise: 'TOP ENERGIE' },
      { grappeKey: 'KAF_G004', entreprise: 'COTRAC' },
      { grappeKey: 'KAF_G005', entreprise: 'Génie plus Senegal' },
      { grappeKey: 'TAM_G001', entreprise: 'Général Service et synergie (CSS)' },
      { grappeKey: 'TAM_G002', entreprise: 'Lebougui all works services (LAWS)' },
      { grappeKey: 'TAM_G003', entreprise: 'Global service plus' },
    ];

    let createdCount = 0;

    for (const ent of lotBEntrepreneurs) {
      const grappe = grappes.find(g => g.grappeKey === ent.grappeKey);
      
      if (grappe) {
        try {
          await prisma.cartoEntrepreneur.create({
            data: {
              organizationId,
              lot: 'B',
              grappeKey: ent.grappeKey,
              mode: 'individuel',
              entreprise: ent.entreprise,
              societe: '',
              telephone: '',
              email: '',
              adresse: ''
            }
          });
          console.log(`✓ ${ent.grappeKey} -> ${ent.entreprise}`);
          createdCount++;
        } catch (err) {
          console.log(`✗ ${ent.grappeKey} déjà existe (${ent.entreprise})`);
        }
      } else {
        console.log(`✗ Grappe ${ent.grappeKey} non trouvée`);
      }
    }

    console.log(`\n✅ Création terminée: ${createdCount} entrepreneurs créés`);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndRecreateEntrepreneurs();
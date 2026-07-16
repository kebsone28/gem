import prisma from './src/core/utils/prisma.js';

async function giveLastKaffrineToLaws() {
  try {
    console.log('=== Donner la dernière grappe Kaffrine à LAWS ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836'; // PROQUELEC

    // Récupérer toutes les grappes Kaffrine
    const kaffrineGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'KAF' }
      },
      include: { region: true },
      orderBy: { grappeNumber: 'desc' } // Dernière grappe = numéro le plus élevé
    });

    console.log('Grappes Kaffrine (triées par numéro):');
    kaffrineGrappes.forEach(g => {
      console.log(`  ${g.grappeKey}: ${g.menageCount} ménages`);
    });

    // La dernière grappe est KAF_G006
    const lastKaffrineGrappe = kaffrineGrappes[0];
    console.log(`\nDernière grappe Kaffrine: ${lastKaffrineGrappe.grappeKey} (${lastKaffrineGrappe.menageCount} ménages)`);

    // Supprimer l'assignation de FATOU THIAM pour cette grappe dans le Lot C
    console.log('\nSuppression de l\'assignation de FATOU THIAM pour cette grappe...');
    const deleted = await prisma.cartoEntrepreneur.deleteMany({
      where: {
        organizationId,
        lot: 'C',
        grappeKey: lastKaffrineGrappe.grappeKey,
        entreprise: 'FATOU THIAM'
      }
    });
    console.log(`✓ ${deleted.count} assignation(s) supprimée(s)`);

    // Créer l'assignation pour LAWS dans le Lot C
    console.log('\nCréation de l\'assignation pour LAWS (Lebougui all works services LAWS):');
    await prisma.cartoEntrepreneur.create({
      data: {
        organizationId,
        lot: 'C',
        grappeKey: lastKaffrineGrappe.grappeKey,
        mode: 'individuel',
        entreprise: 'Lebougui all works services (LAWS)',
        societe: 'Lebougui all works services (LAWS)'
      }
    });
    console.log(`✓ LAWS assigné à ${lastKaffrineGrappe.grappeKey} (${lastKaffrineGrappe.menageCount} ménages)`);

    // Récupérer toutes les grappes Tambacounda pour la vérification
    const tambacoundaGrappes = await prisma.cartoGrappe.findMany({
      where: { 
        organizationId, 
        active: true,
        region: { code: 'TAM' }
      },
      include: { region: true }
    });

    // Vérification finale
    console.log('\n=== Vérification finale Lot C ===');
    const lotCEntrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId, lot: 'C' },
      orderBy: { entreprise: 'asc' }
    });

    const byEntrepreneur = {};
    lotCEntrepreneurs.forEach(e => {
      if (!byEntrepreneur[e.entreprise]) byEntrepreneur[e.entreprise] = [];
      byEntrepreneur[e.entreprise].push(e.grappeKey);
    });

    console.log('\nAssignations Lot C:');
    Object.entries(byEntrepreneur).forEach(([entrepreneur, grappeKeys]) => {
      const grappesInfo = grappeKeys.map(key => {
        const grappe = kaffrineGrappes.find(g => g.grappeKey === key) || 
                      tambacoundaGrappes.find(g => g.grappeKey === key) ||
                      { grappeKey: key, menageCount: 0, region: { name: 'Inconnue' } };
        return `${grappe.grappeKey} (${grappe.menageCount} ménages, ${grappe.region.name})`;
      }).join(', ');
      console.log(`  ${entrepreneur}: ${grappesInfo}`);
    });

    // Vérifier les statistiques
    console.log('\n=== Statistiques mises à jour ===');
    const stats = await prisma.cartoEntrepreneur.groupBy({
      by: ['entreprise'],
      where: { organizationId, lot: 'C' },
      _count: { id: true }
    });

    console.log('Nombre de grappes par entrepreneur (Lot C):');
    stats.forEach(s => {
      console.log(`  ${s.entreprise}: ${s._count.id} grappe(s)`);
    });

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

giveLastKaffrineToLaws();
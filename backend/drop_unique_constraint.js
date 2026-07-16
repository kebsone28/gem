import prisma from './src/core/utils/prisma.js';

async function dropUniqueConstraint() {
  try {
    console.log('=== Suppression de la contrainte unique ===\n');

    // Supprimer la contrainte unique existante
    await prisma.$executeRaw`
      ALTER TABLE "CartoEntrepreneur" 
      DROP CONSTRAINT IF EXISTS "CartoEntrepreneur_organizationId_lot_grappeKey_key"
    `;
    console.log('✓ Contrainte unique supprimée');

    // Créer une nouvelle contrainte unique incluant l'entreprise
    await prisma.$executeRaw`
      ALTER TABLE "CartoEntrepreneur" 
      ADD CONSTRAINT "CartoEntrepreneur_organizationId_lot_grappeKey_entreprise_key" 
      UNIQUE ("organizationId", "lot", "grappeKey", "entreprise")
    `;
    console.log('✓ Nouvelle contrainte unique créée (incluant entreprise)');

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dropUniqueConstraint();
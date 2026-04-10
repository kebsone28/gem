import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDB() {
  try {
    const householdCount = await prisma.household.count();
    const grappeCount = await prisma.grappe.count();
    
    console.log('=== ÉTAT DE LA BASE DE DONNÉES ===\n');
    console.log(`Ménages en DB: ${householdCount}`);
    console.log(`Grappes en DB: ${grappeCount}`);
    
    if (householdCount === 0 && grappeCount === 0) {
      console.log('\n✓ Base de données VIDE');
      console.log('Le problème vient du CACHE FRONTEND (IndexedDB/localStorage)');
    } else {
      console.log('\n✗ Base de données CONTIENT DES DONNÉES');
      console.log('Les données n\'ont pas été supprimées');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();

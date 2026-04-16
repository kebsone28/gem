import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    // Vérifier les tables
    const alerts = await prisma.alert.findMany({ take: 1 });
    const configs = await prisma.alertConfiguration.findMany({ take: 1 });
    
    console.log('✅ Table Alert existe:', alerts.length >= 0);
    console.log('✅ Table AlertConfiguration existe:', configs.length >= 0);
    
    // Compter les lignes
    const alertCount = await prisma.alert.count();
    const configCount = await prisma.alertConfiguration.count();
    
    console.log(`📊 Alert records: ${alertCount}`);
    console.log(`📊 AlertConfiguration records: ${configCount}`);
    console.log('\n✅ Migration réussie!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();

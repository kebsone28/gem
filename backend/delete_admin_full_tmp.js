import prisma from './src/core/utils/prisma.js';

async function cleanupAdminFull() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admingem' } });
    if (!user) {
        console.log('Utilisateur "admingem" non trouvé.');
        return;
    }

    // Deleting related data
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.performanceLog.deleteMany({ where: { userId: user.id } });
    await prisma.syncLog.deleteMany({ where: { userId: user.id } });
    
    // Deleting user
    await prisma.user.delete({ where: { id: user.id } });
    
    console.log(`✅ Utilisateur "admingem" et ses logs supprimés.`);
  } catch (e) {
    console.error('Erreur :', e.message);
  } finally {
    process.exit();
  }
}

cleanupAdminFull();

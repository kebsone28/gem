import prisma from './src/core/utils/prisma.js';

async function cleanupAdminSpecific() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@proquelec.sn' } });
    if (!user) {
        console.log('Utilisateur "admin@proquelec.sn" non trouvé.');
        return;
    }

    // Deleting related data
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.performanceLog.deleteMany({ where: { userId: user.id } });
    await prisma.syncLog.deleteMany({ where: { userId: user.id } });
    await prisma.team.updateMany({ where: { leaderId: user.id }, data: { leaderId: null } });
    
    // Deleting user
    await prisma.user.delete({ where: { id: user.id } });
    
    console.log(`✅ Utilisateur "admin@proquelec.sn" supprimé.`);
  } catch (e) {
    console.error('Erreur :', e.message);
  } finally {
    process.exit();
  }
}

cleanupAdminSpecific();

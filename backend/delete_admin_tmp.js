import prisma from './src/core/utils/prisma.js';

async function cleanupAdmin() {
  try {
    const deleted = await prisma.user.delete({
       where: { email: 'admingem' }
    });
    console.log(`✅ Utilisateur "${deleted.email}" supprimé.`);
  } catch (e) {
    console.error('Erreur (peut être déjà supprimé) :', e.message);
  } finally {
    process.exit();
  }
}

cleanupAdmin();

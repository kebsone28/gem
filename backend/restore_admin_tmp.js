import bcrypt from 'bcryptjs';
import prisma from './src/core/utils/prisma.js';

async function restoreAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('1995@PROQUELEC@2026', salt);
    const securityAnswerHash = await bcrypt.hash('coran', salt); // lowercase/trimmed as per controller logic

    const organization = await prisma.organization.findFirst();
    if (!organization) {
        console.error('Aucune organisation trouvée.');
        return;
    }

    const user = await prisma.user.upsert({
      where: { email: 'admingem' },
      update: {
        passwordHash,
        securityAnswerHash,
        requires2FA: true,
        role: 'ADMIN_PROQUELEC'
      },
      create: {
        email: 'admingem',
        name: 'Administrateur GEM',
        passwordHash,
        securityAnswerHash,
        securityQuestion: 'Quel est votre livre préféré ?', // Adding a default question
        requires2FA: true,
        role: 'ADMIN_PROQUELEC',
        organizationId: organization.id
      }
    });

    console.log(`✅ Admingem restauré : ${user.email}`);
  } catch (e) {
    console.error('Erreur :', e.message);
  } finally {
    process.exit();
  }
}

restoreAdmin();

import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log("🌱 Création de l'admin (local)...");

    const password = 'suprime';
    const answer2FA = 'coran';

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const answerHash = await bcrypt.hash(answer2FA.toLowerCase(), salt);

    let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'PROQUELEC',
          slug: 'proquelec-admin'
        }
      });
      console.log('   Organization created with slug: proquelec-admin');
    } else if (!org.slug) {
      // Update existing org with slug if missing
      org = await prisma.organization.update({
        where: { id: org.id },
        data: { slug: 'proquelec-admin' }
      });
      console.log('   Organization slug updated: proquelec-admin');
    }

    const existing = await prisma.user.findFirst({ where: { email: 'admingem' } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: 'Administrateur PROQUELEC',
          roleLegacy: 'ADMIN_PROQUELEC',
          organizationId: org.id,
          requires2FA: true,
          securityQuestion: 'Votre référence spirituelle',
          securityAnswerHash: answerHash,
        }
      });
    } else {
      await prisma.user.create({
        data: {
          email: 'admingem',
          passwordHash,
          name: 'Administrateur PROQUELEC',
          roleLegacy: 'ADMIN_PROQUELEC',
          organizationId: org.id,
          requires2FA: true,
          securityQuestion: 'Votre référence spirituelle',
          securityAnswerHash: answerHash,
        }
      });
    }

    console.log('✅ Admin créé avec succès!');
    console.log('   Login: admingem');
    console.log('   Password: suprime');
    console.log('   2FA: coran');
  } catch (error) {
    console.error('❌ Erreur:', error?.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

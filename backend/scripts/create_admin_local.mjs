import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

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
      org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
    }

    const existing = await prisma.user.findUnique({ where: { email: 'admingem' } });
    if (existing) {
      await prisma.user.update({
        where: { email: 'admingem' },
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

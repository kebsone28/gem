import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Seeding admin user...');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('suprime', salt);
    const answerHash = await bcrypt.hash('coran', salt);

    // Create organization if not exists
    let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
      console.log('✅ Organization created');
    }

    // Delete existing admin
    const existing = await prisma.user.findUnique({ where: { email: 'admingem' } });
    if (existing) {
      await prisma.user.delete({ where: { email: 'admingem' } });
      console.log('🗑️ Old admin deleted');
    }

    // Create new admin
    const admin = await prisma.user.create({
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

    console.log('✅ Admin user created successfully!');
    console.log('   Email: admingem');
    console.log('   Password: suprime');
    console.log('   2FA Answer: coran');

  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
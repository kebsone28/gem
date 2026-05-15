import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const email = 'admingem';
    const password = 'suprime';
    const securityAnswer = 'CORAN';

    console.log(`🔐 Finding user ${email}...`);
    const foundUser = await prisma.user.findFirst({ where: { email } });
    
    if (!foundUser) {
      throw new Error(`User ${email} not found`);
    }

    console.log(`🔐 Resetting credentials for ${email} (ID: ${foundUser.id})...`);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const securityAnswerHash = await bcrypt.hash(securityAnswer.toLowerCase(), salt);

    const user = await prisma.user.update({
      where: { id: foundUser.id },
      data: {
        passwordHash,
        securityAnswerHash,
        requires2FA: true,
        active: true
      }
    });

    console.log('✅ Credentials reset successfully!');
    console.log('User ID:', user.id);
    console.log('Email:', user.email);
    console.log('2FA Status:', user.requires2FA);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetAdmin() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('suprime', salt);
  const answerHash = await bcrypt.hash('coran', salt);
  
  await prisma.user.update({
    where: { email: 'admingem' },
    data: { 
      passwordHash: hashedPassword,
      securityAnswerHash: answerHash,
      requires2FA: true
    }
  });
  
  console.log('✅ Admin credentials restored to default (suprime / coran)');
  await prisma.$disconnect();
}

resetAdmin();

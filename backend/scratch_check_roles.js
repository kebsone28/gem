
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ take: 5, include: { role: true } });
  console.log('Users:', users.map(u => ({ email: u.email, roleLegacy: u.roleLegacy, roleName: u.role?.name })));
  await prisma.$disconnect();
}

check();

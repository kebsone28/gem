import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const user = await prisma.user.findFirst({ where: { email: 'admingem' } });
    if (user) {
      console.log('Admin user found:', user.email);
      console.log('Requires 2FA:', user.requires2FA);
    } else {
      console.log('Admin user NOT found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();

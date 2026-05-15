import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const count = await prisma.user.count();
    console.log('User count:', count);
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Sample user:', JSON.stringify(users[0], null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();

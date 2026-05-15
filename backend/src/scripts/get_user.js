import prisma from '../core/utils/prisma.js';

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      take: 1
    });
    console.log('--- USERS ---');
    console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

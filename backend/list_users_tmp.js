import prisma from './src/core/utils/prisma.js';

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });
    console.log('--- USERS LIST ---');
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

listUsers();

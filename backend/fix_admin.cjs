const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdmin() {
  const hash = await bcrypt.hash('suprime', 10);
  await prisma.user.updateMany({
    where: { email: 'admingem' },
    data: { passwordHash: hash, requires2FA: false }
  });
  console.log('Admin password fixed properly');
}

fixAdmin().finally(() => process.exit(0));

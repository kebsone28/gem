import { basePrisma } from './src/core/utils/prisma.js';

async function main() {
  const users = await basePrisma.user.findMany({
    select: {
      id: true,
      email: true,
      roleLegacy: true,
      role: {
        select: {
          name: true
        }
      }
    }
  });
  console.log('USERS_LIST_START');
  console.log(JSON.stringify(users, null, 2));
  console.log('USERS_LIST_END');
  await basePrisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await basePrisma.$disconnect();
  process.exit(1);
});

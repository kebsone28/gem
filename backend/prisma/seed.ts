import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'placeholder@example.com' },
    update: {},
    create: {
      email: 'placeholder@example.com',
      name: 'Placeholder',
      organizationId: '00000000-0000-0000-0000-000000000000',
      passwordHash: '',
      roleLegacy: 'user',
    },
  });
  console.log('User ID:', user.id);
  await prisma.mission.createMany({
    data: [
      {
        organizationId: '00000000-0000-0000-0000-000000000000',
        title: 'Mission test',
        createdBy: user.id,
      },
    ],
    skipDuplicates: true,
  });
}
main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

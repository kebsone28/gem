import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Scanning organizations...\n');

  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          users: true,
          projects: true,
          missions: true,
        }
      }
    }
  });

  for (const org of orgs) {
    console.log(`📦 Org: ${org.name}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   Users: ${org._count.users}, Projects: ${org._count.projects}, Missions: ${org._count.missions}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error);

import { basePrisma as prisma } from './core/utils/prisma.js';

async function main() {
  const modules = await prisma.projectModule.findMany({
    where: {
      key: {
        contains: 'ged_os'
      }
    },
    select: {
      id: true,
      key: true,
      name: true,
      projectId: true
    }
  });

  console.log('ProjectModules with ged_os:', JSON.stringify(modules, null, 2));

  const projectsWithLegacyConfig = await prisma.project.findMany({
    where: {
      config: {
        path: ['enabledModules'],
        array_contains: 'ged_os_toolbox'
      }
    },
    select: { id: true, name: true, config: true }
  });

  console.log('Projects with ged_os_toolbox in config:', JSON.stringify(projectsWithLegacyConfig, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

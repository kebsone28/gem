import prisma from '../core/utils/prisma.js';

async function main() {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      take: 5
    });
    console.log('--- ORGANIZATIONS ---');
    console.log(JSON.stringify(orgs, null, 2));
    
    // Pour voir les templates, on utilise basePrisma car Organization est dans EXCLUDED_MODELS
    // Mais ici on veut juste voir si on peut lire les templates
    const templates = await prisma.projectTemplate.findMany({
      select: { id: true, name: true, key: true },
      take: 5
    });
    console.log('--- TEMPLATES ---');
    console.log(JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

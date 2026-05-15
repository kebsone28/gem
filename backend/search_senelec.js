
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function searchSenelec() {
  const projects = await prisma.project.findMany({
    where: { name: { contains: 'Senelec', mode: 'insensitive' } }
  });
  console.log('Projects with Senelec:', projects.map(p => p.name));

  const missions = await prisma.mission.findMany({
    where: { title: { contains: 'Senelec', mode: 'insensitive' } }
  });
  console.log('Missions with Senelec:', missions.map(m => m.title));

  const orgs = await prisma.organization.findMany({
    where: { name: { contains: 'Senelec', mode: 'insensitive' } }
  });
  console.log('Orgs with Senelec:', orgs.map(o => o.name));
}

searchSenelec();

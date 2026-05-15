
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function showAll() {
  const orgs = await prisma.organization.findMany();
  console.log('--- Organizations ---');
  console.log(orgs.map(o => ({ id: o.id, name: o.name })));
  
  const projects = await prisma.project.findMany({
    include: { organization: true }
  });
  console.log('--- Projects ---');
  console.log(projects.map(p => ({ 
    id: p.id, 
    name: p.name, 
    org: p.organization.name,
    orgId: p.organizationId 
  })));
}

showAll();

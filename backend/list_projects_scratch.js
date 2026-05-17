const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.project.findMany().then(projects => {
  console.log('--- PROJECTS ON VPS DB ---');
  console.log(JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, organizationId: p.organizationId })), null, 2));
  process.exit(0);
});

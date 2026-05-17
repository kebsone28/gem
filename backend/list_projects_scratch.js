import { basePrisma as prisma } from './src/core/utils/prisma.js';

prisma.project.findMany().then(projects => {
  console.log('--- PROJECTS ON VPS DB ---');
  console.log(JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, organizationId: p.organizationId })), null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

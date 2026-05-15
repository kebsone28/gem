
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function showAllProjects() {
  const all = await prisma.project.findMany({
    select: { id: true, name: true, status: true, deletedAt: true }
  });
  console.log(all);
}

showAllProjects();

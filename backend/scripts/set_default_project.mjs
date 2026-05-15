#!/usr/bin/env node
// Script: set_default_project.mjs
// Description: For each Organization without defaultProjectId, set it to the first Project (by createdAt)

import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  try {
    const orgs = await prisma.organization.findMany();
    for (const org of orgs) {
      if (org.defaultProjectId) {
        console.log(`Org ${org.id} already has defaultProjectId=${org.defaultProjectId}`);
        continue;
      }

      const project = await prisma.project.findFirst({
        where: { organizationId: org.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      if (!project) {
        console.log(`Org ${org.id} has no projects; skipping.`);
        continue;
      }

      await prisma.organization.update({
        where: { id: org.id },
        data: { defaultProjectId: project.id },
      });

      console.log(`Set defaultProjectId for org ${org.id} -> project ${project.id}`);
    }
  } catch (err) {
    console.error('Error setting default projects:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();

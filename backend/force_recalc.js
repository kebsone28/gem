import { recalculateProjectGrappes } from './src/services/project_config.service.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    try {
        const projectId = '53822af4-601a-434d-bfd9-ccff4fd9eea5';
        console.log(`[FORCE-SYNC] Recalculating grappes for project ${projectId}...`);
        await recalculateProjectGrappes(projectId, '101e841c-f0b2-4ba5-a504-3abbe3dcd7b8', true);
        console.log('[FORCE-SYNC] Done.');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        const projectId = '53822af4-601a-434d-bfd9-ccff4fd9eea5';
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { config: true }
        });
        const grappesInConfig = project?.config?.grappesConfig?.grappes || [];
        const households = await prisma.household.findMany({
            where: { zone: { projectId } },
            select: { id: true, grappeId: true }
        });
        const linkedCount = households.filter(h => h.grappeId).length;
        console.log(`RESULT: Grappes=${grappesInConfig.length}, TotalHouseholds=${households.length}, Linked=${linkedCount}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

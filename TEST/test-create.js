import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    try {
        const firstProject = await prisma.project.findFirst();
        if (!firstProject) throw new Error("No project");
        const mission = await prisma.mission.create({
            data: {
                projectId: firstProject.id,
                organizationId: firstProject.organizationId,
                title: 'Test 1',
                description: 'Test',
                startDate: new Date(),
                endDate: null,
                budget: 500,
                data: {},
                createdBy: 'test',
                status: 'draft'
            }
        });
        console.log('✅ Success:', mission.id);
    } catch(e) {
        console.error('❌ Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

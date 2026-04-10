import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
    try {
        console.log('--- GLOBAL HOUSEHOLD AUDIT ---');
        
        const totalHouseholds = await prisma.household.count();
        console.log(`Total Households in DB: ${totalHouseholds}`);

        const projectCounts = await prisma.household.groupBy({
            by: ['zoneId'],
            _count: { id: true }
        });
        
        console.log('Households by Zone ID:');
        for (const pc of projectCounts) {
            const zone = pc.zoneId ? await prisma.zone.findUnique({ where: { id: pc.zoneId }, select: { name: true, projectId: true } }) : null;
            console.log(`- Zone ${pc.zoneId || 'NULL'} (${zone?.name || 'Unknown'}): ${pc._count.id} households (Project: ${zone?.projectId || 'Unknown'})`);
        }

        const orphanHouseholds = await prisma.household.count({
            where: { zoneId: null }
        });
        console.log(`Orphan Households (No Zone): ${orphanHouseholds}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

audit();

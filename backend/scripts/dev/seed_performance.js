import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const project = await prisma.project.findFirst();
    if (!project) {
        console.log('No project found to seed performance data');
        return;
    }

    const teams = await prisma.team.findMany({
        where: { projectId: project.id, parentTeamId: { not: null } }
    });

    if (teams.length === 0) {
        console.log('No sub-teams found to seed performance data. Please create teams first.');
        return;
    }

    const household = await prisma.household.findFirst({
        where: { zone: { projectId: project.id } }
    });

    console.log(`Seeding logs for ${teams.length} teams...`);

    for (const team of teams) {
        for (let i = 0; i < 10; i++) {
            await prisma.performanceLog.create({
                data: {
                    organizationId: project.organizationId,
                    projectId: project.id,
                    teamId: team.id,
                    userId: team.leaderId,
                    householdId: household?.id,
                    action: 'STATUS_CHANGE',
                    tradeKey: team.tradeKey || 'electricité',
                    oldStatus: 'Initié',
                    newStatus: 'Terminé',
                    timestamp: new Date(Date.now() - Math.random() * 86400000 * 7),
                    details: { value: 1, mock: true }
                }
            });
        }
    }

    console.log('Done.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

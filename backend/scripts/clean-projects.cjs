
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    console.log('🧹 Purge des projets vides...');
    const admin = await prisma.user.findUnique({ where: { email: 'admingem' } });
    if (!admin) {
        console.error('Admin admingem non trouvé');
        process.exit(1);
    }
    
    const orgId = admin.organizationId;
    const projects = await prisma.project.findMany({ 
        where: { organizationId: orgId }
    });

    for (const p of projects) {
        const zoneCount = await prisma.zone.count({ where: { projectId: p.id } });
        const householdCount = await prisma.household.count({ 
            where: { zone: { projectId: p.id } } 
        });

        if (zoneCount === 0 && householdCount === 0) {
            console.log(`🗑️ Projet orphelin détecté: "${p.name}" (${p.id})`);
            await prisma.project.delete({ where: { id: p.id } });
        }
    }
    console.log('✅ Nettoyage terminé.');
    process.exit(0);
}

clean().catch(err => {
    console.error(err);
    process.exit(1);
});

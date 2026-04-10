const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("--- Households by Region ---");
        const hRegions = await prisma.household.groupBy({
            where: { deletedAt: null },
            by: ["region"],
            _count: { _all: true }
        });
        console.log(JSON.stringify(hRegions, null, 2));

        console.log("\n--- Projects Grappes Config ---");
        const projects = await prisma.project.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, config: true }
        });
        projects.forEach(p => {
            const grappes = p.config?.grappesConfig?.grappes || [];
            console.log(`Project: ${p.name} (${p.id}) - Grappes: ${grappes.length}`);
            if (grappes.length > 0) {
                console.log("Sample Grappe Regions:", [...new Set(grappes.map(g => g.region))]);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultItems = [
    { id: 'formation', label: 'Formation 5 équipes (19 électriciens)', region: 'Global', qty: 5, unit: 1500000, rq: 5, ru: 1500000 },
    { id: 'transport', label: 'préparation et Transport matériel', region: 'Global', qty: 3750, unit: 3667, rq: 3750, ru: 3667 },
    { id: 'controle', label: 'Contrôle conformité / reporting', region: 'Global', qty: 3750, unit: 4000, rq: 3750, ru: 4000 },
    { id: 'kaffrine-coffret', label: 'Coffret + potelet + raccordement réseau', region: 'Kaffrine', qty: 2350, unit: 6230, rq: 2350, ru: 4050 },
    { id: 'kaffrine-mur', label: 'Mur support coffret (cheminée)', region: 'Kaffrine', qty: 2000, unit: 35000, rq: 2000, ru: 29000 },
    { id: 'kaffrine-tranchee', label: 'Tranchées + grillage (30x50, 15m)', region: 'Kaffrine', qty: 10000, unit: 1000, rq: 10000, ru: 869 },
    { id: 'kaffrine-coffret-int', label: 'Coffret modulaire + mise à la terre', region: 'Kaffrine', qty: 2350, unit: 23000, rq: 2350, ru: 13500 },
    { id: 'kaffrine-kit2', label: 'Kit secondaire', region: 'Kaffrine', qty: 1000, unit: 6230, rq: 1000, ru: 5000 },
    { id: 'tamba-coffret', label: 'Coffret + potelet + raccordement réseau', region: 'Tambacounda', qty: 1400, unit: 6230, rq: 1400, ru: 4050 },
    { id: 'tamba-mur', label: 'Mur support coffret (cheminée)', region: 'Tambacounda', qty: 1500, unit: 35000, rq: 1500, ru: 29000 },
    { id: 'tamba-tranchee', label: 'Tranchées + grillage (30x50, 15m)', region: 'Tambacounda', qty: 10000, unit: 1000, rq: 10000, ru: 869 },
    { id: 'tamba-coffret-int', label: 'Coffret modulaire + mise à la terre', region: 'Tambacounda', qty: 1400, unit: 23000, rq: 1400, ru: 13500 },
    { id: 'tamba-kit2', label: 'Kit secondaire', region: 'Tambacounda', qty: 1000, unit: 6230, rq: 1000, ru: 5000 }
];

async function run() {
    const projects = await prisma.project.findMany();
    
    for (const project of projects) {
        let config = typeof project.config === 'object' && project.config !== null ? project.config : {};
        if (!config.financials) config.financials = {};
        
        // Base structure
        config.financials.devisItems = defaultItems.map(item => ({
            id: item.id,
            label: item.label,
            region: item.region,
            qty: item.qty,
            unit: item.unit
        }));

        config.financials.plannedCosts = {};
        config.financials.realCosts = {};

        defaultItems.forEach(item => {
            config.financials.plannedCosts[item.id] = { qty: item.qty, unit: item.unit };
            config.financials.realCosts[item.id] = { qty: item.rq, unit: item.ru };
        });

        await prisma.project.update({
            where: { id: project.id },
            data: { config }
        });
        console.log(`Updated project -> ${project.name || project.id}`);
    }
    console.log("Done updating budget defaults.");
}

run().catch(console.error).finally(() => prisma.$disconnect());

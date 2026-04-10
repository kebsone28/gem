import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
    try {
        console.log('--- PROJECT KOBO CONFIG AUDIT ---');
        const projects = await prisma.project.findMany();
        
        for (const p of projects) {
            const config = p.config || {};
            const koboFormId = config.koboFormId || config.formId || config.KOBO_FORM_ID;
            console.log(`Project: ${p.name}`);
            console.log(`- ID: ${p.id}`);
            console.log(`- Kobo Form ID in config: ${koboFormId || 'NONE'}`);
            if (config.grappesConfig) {
                console.log(`- Grappes in config: ${config.grappesConfig.grappes?.length || 0}`);
            }
            console.log('----------------------------');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

audit();

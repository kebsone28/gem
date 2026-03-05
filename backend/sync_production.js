import { PrismaClient } from './prisma/client/index.js';
import dotenv from 'dotenv';

// Load local environment variables
dotenv.config();

/**
 * PROQUELEC Sync Manager v1.0
 * 🔄 Synchronisation Bidirectionnelle Sécurisée Local <-> Cloud
 * 
 * Utilisation :
 *   - PUSH (Local -> Cloud) : DATABASE_URL_REMOTE="url" node sync_production.js --push
 *   - PULL (Cloud -> Local) : DATABASE_URL_REMOTE="url" node sync_production.js --pull
 *   - Options : --dry-run (Simuler sans modifier)
 */

const mode = process.argv.includes('--push') ? 'PUSH' : process.argv.includes('--pull') ? 'PULL' : null;
const dryRun = process.argv.includes('--dry-run');
const remoteUrl = process.env.DATABASE_URL_REMOTE;

if (!mode) {
    console.error('❌ Veuillez spécifier --push ou --pull');
    process.exit(1);
}

if (!remoteUrl) {
    console.error('❌ DATABASE_URL_REMOTE est manquante.');
    process.exit(1);
}

const prismaLocal = new PrismaClient();
const prismaRemote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

async function syncProjects(source, target) {
    console.log(`\n🏗️  Synchronisation des PROJETS...`);
    const projects = await source.project.findMany();
    console.log(`📊 ${projects.length} projets trouvés.`);

    for (const p of projects) {
        if (dryRun) {
            console.log(`[DRY-RUN] Upsert Projet: ${p.name}`);
            continue;
        }
        await target.project.upsert({
            where: { id: p.id },
            update: { name: p.name, description: p.description, status: p.status, config: p.config, updatedAt: p.updatedAt },
            create: { id: p.id, name: p.name, description: p.description, status: p.status, organizationId: p.organizationId, config: p.config, createdAt: p.createdAt, updatedAt: p.updatedAt }
        });
    }
    console.log('✅ Fin Projets.');
}

async function syncHouseholds(source, target) {
    console.log(`\n🏡 Synchronisation des MÉNAGES...`);
    const households = await source.household.findMany({ include: { zone: true } });
    console.log(`📊 ${households.length} ménages trouvés.`);

    let successCount = 0;
    let skipCount = 0;

    for (const h of households) {
        // Protection Anti-Écrasement
        const existing = await target.household.findUnique({ where: { id: h.id }, select: { updatedAt: true } });
        if (existing && existing.updatedAt >= h.updatedAt) {
            skipCount++;
            continue;
        }

        if (dryRun) {
            if (successCount < 5) console.log(`[DRY-RUN] Sync Ménage: ${h.id}`);
            successCount++;
            continue;
        }

        if (h.zone) {
            await target.zone.upsert({
                where: { id: h.zone.id },
                update: { name: h.zone.name },
                create: { id: h.zone.id, name: h.zone.name, projectId: h.zone.projectId, organizationId: h.zone.organizationId }
            });
        }

        await target.household.upsert({
            where: { id: h.id },
            update: { status: h.status, location: h.location, owner: h.owner, koboData: h.koboData, updatedAt: h.updatedAt, version: h.version },
            create: { id: h.id, zoneId: h.zoneId, organizationId: h.organizationId, status: h.status, location: h.location, owner: h.owner, koboData: h.koboData, version: h.version, createdAt: h.createdAt, updatedAt: h.updatedAt }
        });
        successCount++;
        if (successCount % 500 === 0) console.log(`✅ ${successCount} ménages...`);
    }
    console.log(`✅ Fin Ménages. (Succès: ${successCount}, Ignorés: ${skipCount})`);
}

async function main() {
    console.log(`🚀 Mode: ${mode}${dryRun ? ' (DRY-RUN)' : ''}`);
    const source = mode === 'PUSH' ? prismaLocal : prismaRemote;
    const target = mode === 'PUSH' ? prismaRemote : prismaLocal;

    try {
        await syncProjects(source, target);
        await syncHouseholds(source, target);
    } catch (err) {
        console.error('❌ Erreur:', err.message);
    } finally {
        await prismaLocal.$disconnect();
        await prismaRemote.$disconnect();
    }
}

main();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const postgis = await prisma.$queryRaw`SELECT PostGIS_Version()`;
        console.log('--- POSTGIS VERSION ---');
        console.log(JSON.stringify(postgis, null, 2));

        const sample = await prisma.$queryRaw`
            SELECT id, ST_AsText(location_gis) as wkt, "zoneId"
            FROM "Household" 
            WHERE location_gis IS NOT NULL 
            LIMIT 5
        `;
        console.log('--- HOUSEHOLD SPATIAL SAMPLE ---');
        console.log(JSON.stringify(sample, null, 2));

        const tables = await prisma.$queryRaw`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public'
        `;
        console.log('--- TABLES ---');
        console.log(JSON.stringify(tables, null, 2));
    } catch (e) {
        console.error('Error during audit:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

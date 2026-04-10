import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const projectId = "proj_1772563607211";
        const organizationId = "org_1772439167290"; // Let's guess or assume it exists

        console.log('Testing queries with variables...');

        const koboAggrResult = await prisma.$queryRaw`
            SELECT 
                SUM(COALESCE(NULLIF("koboData"->'group_ed3yt17'->>'Nombre_de_KIT_pr_par', '')::numeric, 0)) as kit_prepared,
                SUM(COALESCE(NULLIF("koboData"->'group_ed3yt17'->>'Nombre_de_KIT_Charg_pour_livraison', '')::numeric, 0)) as kit_loaded,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Cable_2_5mm_Int_rieure', '')::numeric, 0)) as cable_2_5,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Cable_1_5mm_Int_rieure', '')::numeric, 0)) as cable_1_5,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_Cable_arm_4mm', '')::numeric, 0)) as cable_4_armed,
                SUM(COALESCE(NULLIF("koboData"->'group_wu8kv54'->'group_sy9vj14'->>'Longueur_Tranch_e_C_ble_arm_1_5mm', '')::numeric, 0)) as cable_1_5_armed,
                COUNT(DISTINCT "koboData"->>'today') as days_worked,
                COUNT(*) filter (where status = 'Terminé' OR status = 'Réception: Validée') as total_validated
            FROM "Household" h
            JOIN "Zone" z ON h."zoneId" = z.id
            WHERE z."projectId" = ${projectId} AND h."organizationId" = ${organizationId} AND h."deletedAt" IS NULL
        `;

        console.log('koboAggrResult success', koboAggrResult);
    } catch (e) {
        console.error('Error in queryRaw', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

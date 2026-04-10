
import prisma from './src/core/utils/prisma.js';

async function diagnose() {
    try {
        console.log('--- 🛡️ DIAGNOSTIC DB ---');
        
        // 1. Check if Household has the new columns
        try {
            const h = await prisma.household.findFirst();
            if (h) {
                console.log('Columns constructionData:', h.constructionData !== undefined ? 'OK' : 'MISSING');
                console.log('Columns alerts:', h.alerts !== undefined ? 'OK' : 'MISSING');
            }
        } catch (e) {
            console.error('❌ Error fetching household:', e.message);
        }

        // 2. Check for BigInt values (Serialization risk)
        const bigIntCount = await prisma.household.count({
            where: { koboSubmissionId: { not: null } }
        });
        console.log('Households with BigInt values (koboSubmissionId):', bigIntCount);

        // 3. Check for null coordinates that might crash Mapbox

    } catch (e) {
        console.error('Fatal diagnostic error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();

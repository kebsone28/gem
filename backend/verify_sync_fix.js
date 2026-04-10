
import prisma from './src/core/utils/prisma.js';

// Mock the BigInt fix
BigInt.prototype.toJSON = function() { return this.toString(); };

async function verify() {
    try {
        console.log('--- 🧪 VERIFICATION SYNC PULL ---');
        
        const rawHouseholds = await prisma.household.findMany({
            take: 5,
            include: { zone: { select: { projectId: true } } }
        });

        const households = rawHouseholds.map(h => ({
            ...h,
            projectId: h.zone?.projectId,
            zone: undefined,
            latitude: h.latitude || 0,
            longitude: h.longitude || 0
        }));

        const result = {
            timestamp: new Date().toISOString(),
            changes: { households }
        };

        // This is what res.json() does internally
        const json = JSON.stringify(result);
        console.log('✅ JSON Serialization successful!');
        
        const parsed = JSON.parse(json);
        const sample = parsed.changes.households[0];
        if (sample) {
            console.log('Sample Latitude:', sample.latitude);
            console.log('Sample koboSubmissionId Type:', typeof sample.koboSubmissionId);
        }

    } catch (e) {
        console.error('❌ Verification failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();

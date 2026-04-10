/**
 * Check for Maodo Diallo duplicates and status issues
 */

import prisma from './src/core/utils/prisma.js';

async function checkDuplicates() {
    console.log('🔍 Checking for Maodo Diallo duplicates...\n');

    // Find all records with similar name
    const records = await prisma.household.findMany({
        where: {
            OR: [
                { name: { contains: 'Maodo', mode: 'insensitive' } },
                { name: { contains: 'Diallo', mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            name: true,
            status: true,
            koboSubmissionId: true,
            koboData: true,
            deletedAt: true,
            updatedAt: true
        },
        orderBy: { updatedAt: 'desc' }
    });

    console.log(`Found ${records.length} records:\n`);
    
    records.forEach((r, idx) => {
        console.log(`${idx + 1}. ID: ${r.id}`);
        console.log(`   Name: ${r.name}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Kobo Submission ID: ${r.koboSubmissionId || '(null)'}`);
        console.log(`   Deleted: ${r.deletedAt ? 'YES' : 'NO'}`);
        console.log(`   Updated: ${r.updatedAt.toISOString()}`);
        
        // Check koboData for "Situation du Ménage" field
        if (r.koboData) {
            console.log(`   Kobo Data keys: ${Object.keys(r.koboData).slice(0, 5).join(', ')}`);
            
            // Search for situation/eligibility fields
            const situationKeys = Object.keys(r.koboData).filter(k => 
                k.toLowerCase().includes('situation') || 
                k.toLowerCase().includes('eligible') ||
                k.toLowerCase().includes('eligibilite')
            );
            
            if (situationKeys.length > 0) {
                console.log(`   ⚠️  Eligibility-related fields found:`);
                situationKeys.forEach(key => {
                    console.log(`       - ${key}: ${r.koboData[key]}`);
                });
            } else {
                console.log(`   ℹ️  No explicit eligibility field in koboData`);
            }
        }
        console.log('');
    });

    if (records.length === 0) {
        console.log('❌ No Maodo Diallo records found!');
    } else if (records.length > 1) {
        console.log(`⚠️  DUPLICATE DETECTED: ${records.length} records for same person`);
        
        // Check if they have same koboSubmissionId
        const bySubmission = {};
        records.forEach(r => {
            const key = r.koboSubmissionId || 'NO_SUBMISSION_ID';
            if (!bySubmission[key]) bySubmission[key] = [];
            bySubmission[key].push(r.id);
        });
        
        console.log('\nGrouped by koboSubmissionId:');
        Object.entries(bySubmission).forEach(([submissionId, ids]) => {
            console.log(`  submissionId="${submissionId}": ${ids.length} record(s)`);
            if (ids.length > 1) {
                console.log(`    ❌ DUPLICATE for submission=${submissionId}`);
            }
        });
    } else {
        console.log('✅ No duplicates detected');
    }

    process.exit(0);
}

checkDuplicates().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});

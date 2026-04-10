/**
 * Manually re-sync and update Maodo Diallo's status from Kobo
 * This will:
 * 1. Fetch submissions from Kobo for the specific household
 * 2. Extract status using the new extractStatus() logic
 * 3. Update the database with correct status
 */

import prisma from './src/core/utils/prisma.js';
import { 
    extractNumeroOrdre, 
    transformRowToHousehold 
} from './src/services/kobo.mapping.js';
import { fetchKoboSubmissions } from './src/services/kobo.service.js';

async function updateMaodoStatus() {
    console.log('🔄 Fetching Kobo submissions...\n');
    
    try {
        // Get all Kobo submissions
        const submissions = await fetchKoboSubmissions();
        console.log(`✅ Fetched ${submissions.length} submissions from Kobo\n`);

        // Find submissions for Maodo Diallo (numeroordre 4526)
        const maodoSubmissions = submissions.filter(sub => {
            const numero = 
                sub['Numero ordre'] || 
                sub['Numero_ordre'] || 
                sub['NUMERO ORDRE'] ||
                null;
            return numero === '4526' || numero === 4526;
        });

        console.log(`Found ${maodoSubmissions.length} submissions for Maodo Diallo (numeroordre 4526):\n`);

        if (maodoSubmissions.length === 0) {
            console.log('❌ No submissions found for Maodo Diallo!');
            process.exit(1);
        }

        // Process each submission
        for (const submission of maodoSubmissions) {
            console.log(`📋 Submission ID: ${submission['_id']}`);
            console.log(`   Time: ${submission['_submission_time']}`);
            
            // Extract using new mapping
            const household = transformRowToHousehold(submission, 'org-default', 'zone-default');
            
            if (!household) {
                console.log('   ❌ Mapping failed\n');
                continue;
            }

            console.log(`   ✓ Mapped status: "${household.status}"`);
            
            // Check what Situation du Ménage field contains
            const situationKeys = Object.keys(submission).filter(k => 
                k.includes('Situation') && (k.includes('M_nage') || k.includes('Menage'))
            );
            
            if (situationKeys.length > 0) {
                console.log(`   ℹ️  Raw "Situation du Ménage" value:`);
                situationKeys.forEach(key => {
                    console.log(`       - ${key}: "${submission[key]}"`);
                });
            } else {
                console.log(`   ℹ️  No "Situation du Ménage" field found`);
            }

            // Find existing household
            const existing = await prisma.household.findFirst({
                where: { name: { contains: 'Maodo', mode: 'insensitive' } }
            });

            if (existing) {
                console.log(`   Current status in DB: "${existing.status}"`);
                
                if (existing.status !== household.status) {
                    console.log(`   🔄 Updating status: "${existing.status}" → "${household.status}"`);
                    
                    // Update database
                    await prisma.household.update({
                        where: { id: existing.id },
                        data: {
                            status: household.status,
                            koboData: submission,
                            koboSubmissionId: BigInt(submission['_id']),
                            updatedAt: new Date()
                        }
                    });
                    
                    console.log(`   ✅ Updated in database!\n`);
                } else {
                    console.log(`   ✅ Status already correct\n`);
                }
            } else {
                console.log(`   ❌ Household not found in database\n`);
            }
        }

        // Final verification
        console.log('📊 Final verification:');
        const final = await prisma.household.findFirst({
            where: { name: { contains: 'Maodo', mode: 'insensitive' } }
        });

        if (final) {
            console.log(`   Name: ${final.name}`);
            console.log(`   Status: ${final.status}`);
            console.log(`   Updated: ${final.updatedAt.toISOString()}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updateMaodoStatus();

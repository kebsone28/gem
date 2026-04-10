/**
 * Extract and display the actual Kobo form field structure
 * Shows all field names as they come from Kobo submissions
 */

import prisma from './src/core/utils/prisma.js';

async function analyzeKoboFormStructure() {
    console.log('🔍 Analyzing actual Kobo form field structure...\n');

    try {
        // Get all household records with koboData
        const households = await prisma.household.findMany({
            where: {
                koboData: { not: {} }
            },
            select: {
                id: true,
                name: true,
                status: true,
                koboData: true
            },
            take: 10
        });

        console.log(`Found ${households.length} households with Kobo data\n`);

        if (households.length === 0) {
            console.log('❌ No households with Kobo data found');
            process.exit(0);
        }

        // Collect all unique field names across all submissions
        const allFields = new Set();
        const fieldExamples = {};

        households.forEach(h => {
            if (h.koboData && typeof h.koboData === 'object') {
                Object.keys(h.koboData).forEach(key => {
                    allFields.add(key);

                    // Store first example for each field
                    if (!fieldExamples[key]) {
                        fieldExamples[key] = {
                            value: h.koboData[key],
                            from: h.name || 'Unknown'
                        };
                    }
                });
            }
        });

        // Categorize fields
        console.log('📊 ALL KOBO FORM FIELDS:\n');

        const fields = Array.from(allFields).sort();

        // Group by prefix (for grouped fields)
        const grouped = {};
        const standalone = [];

        fields.forEach(f => {
            if (f.includes('/')) {
                const group = f.split('/')[0];
                if (!grouped[group]) grouped[group] = [];
                grouped[group].push(f);
            } else {
                standalone.push(f);
            }
        });

        console.log('🏗️  GROUPED FIELDS (inside form groups):');
        console.log('='.repeat(60));
        Object.entries(grouped).forEach(([group, fields]) => {
            console.log(`\n  GROUP: ${group}`);
            fields.forEach(f => {
                const fieldName = f.split('/')[1];
                const example = fieldExamples[f];
                console.log(`    • ${fieldName}`);
                console.log(`      Example value: "${example.value}" (from: ${example.from})`);
            });
        });

        console.log('\n\n🏷️  STANDALONE FIELDS (top level):');
        console.log('='.repeat(60));
        standalone.forEach(f => {
            const example = fieldExamples[f];
            console.log(`  • ${f}`);
            console.log(`    Example value: "${example.value}"`);
        });

        console.log('\n\n📋 FIELD COUNT SUMMARY:');
        console.log('='.repeat(60));
        console.log(`Total unique fields: ${allFields.size}`);
        console.log(`  - In groups: ${Object.values(grouped).reduce((a, b) => a + b.length, 0)}`);
        console.log(`  - Standalone: ${standalone.length}`);

        // Find fields related to our key searches
        console.log('\n\n🎯 RELEVANT FIELDS FOR STATUS EXTRACTION:');
        console.log('='.repeat(60));

        const situationFields = fields.filter(f =>
            f.toLowerCase().includes('situation') ||
            f.toLowerCase().includes('eligible') ||
            f.toLowerCase().includes('statut')
        );

        if (situationFields.length > 0) {
            console.log('Status/Eligibility fields found:');
            situationFields.forEach(f => {
                const example = fieldExamples[f];
                console.log(`  • ${f}`);
                console.log(`    Value: "${example.value}"`);
            });
        } else {
            console.log('❌ No status/eligibility fields found');
        }

        // Find numeroordre fields
        console.log('\n🔢 NUMEROORDRE / ID FIELDS:');
        const numeroFields = fields.filter(f =>
            f.toLowerCase().includes('numero') ||
            f.toLowerCase().includes('menage') ||
            f.toLowerCase().includes('id_')
        );

        if (numeroFields.length > 0) {
            numeroFields.forEach(f => {
                const example = fieldExamples[f];
                console.log(`  • ${f}`);
                console.log(`    Value: "${example.value}"`);
            });
        }

        // Find validation checkpoint fields
        console.log('\n✅ VALIDATION CHECKPOINT FIELDS:');
        const validationFields = fields.filter(f =>
            f.includes('valide') ||
            f.includes('confirme') ||
            f.includes('conforme')
        );

        if (validationFields.length > 0) {
            validationFields.forEach(f => {
                const example = fieldExamples[f];
                console.log(`  • ${f}`);
                console.log(`    Value: "${example.value}"`);
            });
        }

        // Full export (for reference)
        console.log('\n\n📄 FULL EXPORT (all field:value pairs):');
        console.log('='.repeat(60));
        console.log(JSON.stringify(fieldExamples, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

analyzeKoboFormStructure();

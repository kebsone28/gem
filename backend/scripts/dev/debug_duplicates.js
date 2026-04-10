/**
 * Debug: Check for duplicate households in database
 * Look for:
 * 1. Households with same numeroordre (shouldn't exist)
 * 2. Households with same name and similar coordinates
 * 3. Check Kobo submission IDs to verify no sync duplicates
 */

import prisma from './src/core/utils/prisma.js';

async function debugDuplicates() {
    console.log('🔍 Searching for potential duplicate households...\n');

    try {
        // 1. Check for households appearing near same coordinates
        const allHouseholds = await prisma.household.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                status: true,
                deletedAt: true
            }
        });

        console.log(`Total households in DB: ${allHouseholds.length}\n`);

        // Group by approximate location (within 0.001 degrees = ~100 meters)
        const locationGroups = {};
        
        allHouseholds.forEach(h => {
            if (h.latitude && h.longitude) {
                // Round to 3 decimals (precision of ~100m)
                const key = `${Math.round(h.latitude * 1000) / 1000},${Math.round(h.longitude * 1000) / 1000}`;
                if (!locationGroups[key]) locationGroups[key] = [];
                locationGroups[key].push(h);
            }
        });

        // Find locations with multiple households
        const duplicateLocations = Object.entries(locationGroups).filter(([key, group]) => group.length > 1);
        console.log(`Locations with multiple households: ${duplicateLocations.length}\n`);

        if (duplicateLocations.length > 0) {
            console.log('⚠️  Potential duplicate locations found:\n');
            
            duplicateLocations.forEach(([location, households]) => {
                console.log(`📍 Location: ${location}`);
                households.forEach(h => {
                    console.log(`   - ${h.name} (ID: ${h.id.substring(0, 8)}...)`);
                    console.log(`     Status: ${h.status}, Deleted: ${h.deletedAt ? 'YES' : 'NO'}`);
                });
                console.log('');
            });
        } else {
            console.log('✅ No duplicate locations found\n');
        }

        // 2. Check for same name with different IDs
        const nameGroups = {};
        allHouseholds.forEach(h => {
            const name = (h.name || 'Unknown').toLowerCase().trim();
            if (!nameGroups[name]) nameGroups[name] = [];
            nameGroups[name].push(h);
        });

        const duplicateNames = Object.entries(nameGroups).filter(([name, group]) => 
            group.length > 1 && name !== 'unknown'
        );

        console.log(`Names appearing multiple times: ${duplicateNames.length}\n`);

        if (duplicateNames.length > 0) {
            console.log('⚠️  Duplicate names found:\n');
            
            duplicateNames.slice(0, 10).forEach(([name, households]) => {
                console.log(`👥 Name: "${name}" (${households.length} records)`);
                households.forEach(h => {
                    console.log(`   - ID: ${h.id.substring(0, 8)}...`);
                    console.log(`     Location: (${h.latitude}, ${h.longitude})`);
                    console.log(`     Status: ${h.status}`);
                });
                console.log('');
            });
        }

        // 3. Specific check for Maodo Diallo
        console.log('🔎 Specific check for Maodo Diallo:\n');
        const maodoRecords = await prisma.household.findMany({
            where: {
                name: { contains: 'Maodo', mode: 'insensitive' },
                deletedAt: null
            }
        });

        console.log(`Found ${maodoRecords.length} non-deleted record(s) with name containing "Maodo":`);
        maodoRecords.forEach(m => {
            console.log(`  ID: ${m.id}`);
            console.log(`  Name: ${m.name}`);
            console.log(`  Status: ${m.status}`);
            console.log(`  Location: (${m.latitude}, ${m.longitude})`);
            console.log(`  Kobo Submission ID: ${m.koboSubmissionId}`);
            console.log('');
        });

        if (maodoRecords.length === 1) {
            console.log('✅ Only 1 record for Maodo Diallo - no duplicate in DB\n');
            console.log('➡️  If there\'s a duplicate on the map, it may be:');
            console.log('   1. A cache issue in frontend IndexedDB');
            console.log('   2. Two map point clusters overlapping');
            console.log('   3. Temporary display glitch (refresh should fix it)');
        } else if (maodoRecords.length > 1) {
            console.log(`❌ DUPLICATE: ${maodoRecords.length} records for Maodo Diallo!\n`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

debugDuplicates();

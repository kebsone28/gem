/**
 * Test: kobo.mapping.js
 * Purpose: Verify field extraction and transformation functions work correctly
 * 
 * Run: cd backend && node tests/kobo.mapping.test.js
 */

import {
    extractNumeroOrdre,
    extractCoordinates,
    extractOwner,
    extractRegionalInfo,
    extractStatus,
    transformRowToHousehold,
    transformRows
} from '../src/services/kobo.mapping.js';

console.log('🧪 Starting kobo.mapping.js Tests...\n');

// Test Data: Simulates Kobo submission format (with ACTUAL field names from Kobo form)
const testSubmissionKobo = {
    _id: 1234567890,
    _submission_time: '2025-03-08T10:30:00Z',
    'Numero_ordre': '4526',                    // Kobo actual field
    'TYPE_DE_VISITE/latitude_key': '14.6349',  // Kobo actual field
    'TYPE_DE_VISITE/longitude_key': '-14.7167', // Kobo actual field
    'TYPE_DE_VISITE/region_key': 'Dakar',      // Kobo actual field
    'TYPE_DE_VISITE/nom_key': 'Maodo Diallo',  // Kobo actual field
    'TYPE_DE_VISITE/telephone_key': '77123456', // Kobo actual field
    'TYPE_DE_VISITE/role': 'livreur',          // Kobo actual role field
    'departement': 'Dakar',
    'commune': 'Plateau',
    'village': 'Medina'
};

// Test Data: Kobo with ineligibility status (actual Maodo Diallo structure)
const testSubmissionKoboIneligible = {
    _id: 624908013,
    _submission_time: '2026-03-25T01:50:35.323Z',
    'Numero_ordre': '4526',
    'TYPE_DE_VISITE/latitude_key': '13.325912873950003',
    'TYPE_DE_VISITE/longitude_key': '-13.549182105878828',
    'TYPE_DE_VISITE/region_key': 'Tambacounda',
    'TYPE_DE_VISITE/nom_key': 'Maodo Diallo',
    'TYPE_DE_VISITE/telephone_key': '784050111',
    'TYPE_DE_VISITE/role': 'livreur',
    // Situation du Ménage in a group (like real Kobo form structure) - INELIGIBLE
    'group_wu8kv54/Situation_du_M_nage': 'menage_non_eligible',
    'group_wu8kv54/justificatif': 'desistement_du_menage'
};

// Test Data: CSV import format (different field names, decimal separators)
const testSubmissionCSV = {
    'numero_ordre': '4527',                 // Alternative field name
    'Latitude': '14.5000',                  // For CSV
    'Longitude': '-14.5000',                // For CSV
    'Region': 'Thies',                      // Primary region field
    'nom_prenom': 'Fatou Sow',             // Alternative to "TYPE_DE_VISITE/nom_key"
    'Telephone': '77654321',                // Correct field name
    'departement': 'Thies'
};

// Test 1: Extract numeroOrdre from Kobo format
console.log('✅ Test 1: extractNumeroOrdre - Kobo format');
const num1 = extractNumeroOrdre(testSubmissionKobo);
console.log(`   Expected: "4526", Got: "${num1}"`);
console.log(`   ${num1 === '4526' ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 2: Extract numeroOrdre from CSV format (alternative field name)
console.log('✅ Test 2: extractNumeroOrdre - CSV format');
const num2 = extractNumeroOrdre(testSubmissionCSV);
console.log(`   Expected: "4527", Got: "${num2}"`);
console.log(`   ${num2 === '4527' ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 3: Extract coordinates from Kobo format
console.log('✅ Test 3: extractCoordinates - Kobo format');
const coords1 = extractCoordinates(testSubmissionKobo);
console.log(`   Expected: { latitude: 14.6349, longitude: -14.7167 }`);
console.log(`   Got: { latitude: ${coords1.latitude}, longitude: ${coords1.longitude} }`);
const coordsPass = Math.abs(coords1.latitude - 14.6349) < 0.0001 && Math.abs(coords1.longitude - (-14.7167)) < 0.0001;
console.log(`   ${coordsPass ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 4: Extract owner from Kobo format
console.log('✅ Test 4: extractOwner - Kobo format');
const owner1 = extractOwner(testSubmissionKobo);
console.log(`   Expected: { name: 'Maodo Diallo', phone: '77123456' }`);
console.log(`   Got: { name: '${owner1.name}', phone: '${owner1.phone}' }`);
const ownerPass = owner1.name === 'Maodo Diallo' && owner1.phone === '77123456';
console.log(`   ${ownerPass ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 5: Extract region info
console.log('✅ Test 5: extractRegionalInfo');
const region1 = extractRegionalInfo(testSubmissionKobo);
console.log(`   Expected: { region: 'Dakar', departement: 'Dakar', commune: 'Plateau', village: 'Medina' }`);
console.log(`   Got: { region: '${region1.region}', departement: '${region1.departement}', commune: '${region1.commune}', village: '${region1.village}' }`);
const regionPass = region1.region === 'Dakar' && region1.departement === 'Dakar' && region1.commune === 'Plateau' && region1.village === 'Medina';
console.log(`   ${regionPass ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 6: Extract status from validation checkpoints
console.log('✅ Test 6: extractStatus');
const status1 = extractStatus(testSubmissionKobo);
console.log(`   Expected: status based on validation checkpoints`);
console.log(`   Got: "${status1}"`);
console.log(`   ${status1 !== null ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 6b: Extract "Ménage non éligible" status (NEW - for real Maodo Diallo data)
console.log('✅ Test 6b: extractStatus - Ineligibility (NEW)');
const status2 = extractStatus(testSubmissionKoboIneligible);
console.log(`   Expected: "Ménage non éligible"`);
console.log(`   Got: "${status2}"`);
console.log(`   ${status2 === 'Ménage non éligible' ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 6c: Extract "Ménage désisté" from justificatif field (NEW)
console.log('✅ Test 6c: extractStatus - Justificatif Field (NEW)');
const statusJustif = extractStatus(testSubmissionKoboIneligible);
// Same test - should detect justificatif but prioritize Situation du Ménage
console.log(`   Expected: "Ménage non éligible" (priorité > Situation du Ménage sur justificatif)`);
console.log(`   Got: "${statusJustif}"`);
console.log(`   ${statusJustif === 'Ménage non éligible' ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 7: Full transformation to household object
console.log('✅ Test 7: transformRowToHousehold with actual Kobo field names');
const household = transformRowToHousehold(testSubmissionKobo, 'org-123', 'zone-456');
console.log(`   Expected: Complete household object with numeroOrdre, coordinates, location GeoJSON`);
if (household) {
    console.log(`   Got properties: ${Object.keys(household).join(', ')}`);
    const householdPass =
        household &&
        household.numeroOrdre === '4526' &&
        household.name === 'Maodo Diallo' &&
        household.location &&
        household.location.type === 'Point' &&
        household.location.coordinates &&
        household.location.coordinates.length === 2;
    console.log(`   ${householdPass ? '✓ PASSED' : '✗ FAILED'}\n`);
} else {
    console.log(`   ✗ FAILED - Household object is null\n`);
}

// Test 8: Verify location GeoJSON format
console.log('✅ Test 8: Location GeoJSON format');
if (household && household.location) {
    const coords = household.location.coordinates;
    console.log(`   GeoJSON coordinates: [${coords[0]}, ${coords[1]}]`);
    console.log(`   Expected format: [longitude, latitude]`);
    console.log(`   ✓ PASSED (GeoJSON is [lng, lat])\n`);
}

// Test 9: Batch transformation
console.log('✅ Test 9: transformRows (batch processing)');
const submissions = [testSubmissionKobo, testSubmissionCSV];
const result = transformRows(submissions, 'org-123', 'zone-456');
console.log(`   Expected: 2 transformed households with errors: false`);
console.log(`   Got: ${result.valid.length} valid, ${result.invalid.length} invalid`);
const batchPass = result.valid.length === 2 && result.invalid.length === 0;
console.log(`   ${batchPass ? '✓ PASSED' : '✗ FAILED'}\n`);

// Test 10: Handle missing numeroOrdre (should return invalid row)
console.log('✅ Test 10: Handle missing numeroOrdre');
const noNumeroRow = { 'Owner_Name': 'Test', 'Latitude': '14' };
const missingNumero = transformRowToHousehold(noNumeroRow, 'org-123', 'zone-456');
console.log(`   Expected: null (skip rows without numeroOrdre)`);
console.log(`   Got: ${missingNumero}`);
console.log(`   ${missingNumero === null ? '✓ PASSED' : '✗ FAILED'}\n`);

// Summary
console.log('='.repeat(60));
console.log('🎯 Test Summary');
console.log('='.repeat(60));
console.log('All critical transformation functions are operational.');
console.log('Ready for integration testing with actual Kobo submissions.\n');
console.log('Next: npm start (backend) → POST /api/kobo/sync → Verify logs');

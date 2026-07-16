/**
 * Phase 1 Migration: JSON files → GED OS unified tables
 *
 * Data sources:
 *   frontend/public/archive/Liste/menages.json   (3536 households)
 *   frontend/public/archive/Liste/villages.json   (75 villages)
 *   frontend/public/archive/Liste/gps.json        (3536 GPS coords)
 *
 * Target tables:
 *   Region, Grappe → existing GED OS tables
 *   Household → existing GED OS table (with constructionData for lot statuses)
 *   Prestataire → new unified table
 *
 * Run: node migrate_json_to_unified.js [--dry-run]
 */

import prisma from './src/core/utils/prisma.js';
import logger from './src/utils/logger.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ORG_ID = 'default'; // Will be updated to real orgId at runtime

function loadJson(filename) {
  const path = resolve('..', 'frontend', 'public', 'archive', 'Liste', filename);
  let raw = readFileSync(path, 'utf8');
  // Strip BOM (Byte Order Mark) if present
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

// ══════════════════════════════════════════════════════════════
// Step 1: Ensure Regions exist
// ══════════════════════════════════════════════════════════════
async function ensureRegions(orgId) {
  logger.info('=== Step 1: Ensuring Regions ===');

  const villages = loadJson('villages.json');
  const regionNames = [...new Set(villages.map((v) => v.region))];
  logger.info(`Found ${regionNames.length} regions: ${regionNames.join(', ')}`);

  const results = {};
  for (const name of regionNames) {
    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would ensure Region: ${name}`);
      results[name] = `dry-run-${name}`;
      continue;
    }

    let region = await prisma.region.findFirst({ where: { name } });
    if (!region) {
      region = await prisma.region.create({ data: { name } });
      logger.info(`  Created Region: ${name} (${region.id})`);
    } else {
      logger.info(`  Region exists: ${name} (${region.id})`);
    }
    results[name] = region.id;
  }

  return results;
}

// ══════════════════════════════════════════════════════════════
// Step 2: Ensure Grappes exist (from village data)
// ══════════════════════════════════════════════════════════════
async function ensureGrappes(orgId, regionIds) {
  logger.info('=== Step 2: Ensuring Grappes ===');

  const villages = loadJson('villages.json');

  // Build grappe list: each village has a defaultGrappe
  const grappeMap = new Map(); // "region|grappeNum" → { region, grappeNum, villages }

  for (const v of villages) {
    const key = `${v.region}|${v.defaultGrappe}`;
    if (!grappeMap.has(key)) {
      grappeMap.set(key, { region: v.region, grappeNum: v.defaultGrappe, villages: [] });
    }
    grappeMap.get(key).villages.push(v.village);
  }

  logger.info(`Found ${grappeMap.size} grappes across regions`);

  const results = {};
  for (const [key, grappe] of grappeMap) {
    const grappeName =
      grappe.region === 'Kaffrine'
        ? `KAF_G${String(grappe.grappeNum).padStart(3, '0')}`
        : `TAM_G${String(grappe.grappeNum).padStart(3, '0')}`;

    const regionId = regionIds[grappe.region];
    if (!regionId) {
      logger.warn(`  Region ${grappe.region} not found, skipping grappe ${grappeName}`);
      continue;
    }

    if (DRY_RUN) {
      logger.info(
        `[DRY-RUN] Would ensure Grappe: ${grappeName} (${grappe.villages.length} villages)`
      );
      results[key] = `dry-run-${grappeName}`;
      continue;
    }

    let grappeRecord = await prisma.grappe.findFirst({
      where: { name: grappeName, regionId },
    });

    if (!grappeRecord) {
      grappeRecord = await prisma.grappe.create({
        data: {
          name: grappeName,
          regionId,
          organizationId: orgId,
        },
      });
      logger.info(`  Created Grappe: ${grappeName} (${grappeRecord.id})`);
    } else {
      logger.info(`  Grappe exists: ${grappeName} (${grappeRecord.id})`);
    }
    results[key] = grappeRecord.id;
  }

  return results;
}

// ══════════════════════════════════════════════════════════════
// Step 3: Import Households
// ══════════════════════════════════════════════════════════════
async function importHouseholds(orgId, regionIds, grappeIds) {
  logger.info('=== Step 3: Importing Households ===');

  const menages = loadJson('menages.json');
  const villages = loadJson('villages.json');
  const gps = loadJson('gps.json');

  // Build village lookup: "region|village" → village data
  const villageLookup = new Map();
  for (const v of villages) {
    villageLookup.set(`${v.region}|${v.village}`, v);
  }

  // Build grappe lookup: "region|defaultGrappe" → grappeId
  const grappeLookup = new Map();
  for (const [key, grappeId] of Object.entries(grappeIds)) {
    grappeLookup.set(key, grappeId);
  }

  let created = 0,
    updated = 0,
    skipped = 0,
    withGps = 0;

  // Process in batches of 500
  const BATCH_SIZE = 500;

  for (let i = 0; i < menages.length; i += BATCH_SIZE) {
    const batch = menages.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      logger.info(
        `[DRY-RUN] Would process batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} menages)`
      );
      created += batch.length;
      continue;
    }

    const batchData = [];

    for (const m of menages.slice(i, i + BATCH_SIZE)) {
      const villageKey = `${m.region}|${m.village}`;
      const villageData = villageLookup.get(villageKey);
      const gpsData = gps[String(m.ordre)];

      const grappeKey = `${m.region}|${villageData?.defaultGrappe || 1}`;
      const grappeId = grappeLookup.get(grappeKey) || null;

      if (gpsData) withGps++;

      batchData.push({
        numeroordre: String(m.ordre),
        name: m.nom || null,
        phone: m.tel || null,
        region: m.region || null,
        village: m.village || null,
        commune: m.commune || null,
        latitude: gpsData ? gpsData[0] : villageData?.lat || null,
        longitude: gpsData ? gpsData[1] : villageData?.lon || null,
        status: 'planned',
        organizationId: orgId,
        grappeId: grappeId,
        source: 'carto-import',
        owner: {
          chefNom: m.nom,
          telephone: m.tel,
          village: m.village,
          commune: m.commune,
        },
        location: {},
        constructionData: {
          cartoOrdre: m.ordre,
          cartoImported: true,
        },
        koboData: {},
        koboSync: {},
      });
    }

    // Upsert each household by numeroordre (avoid duplicates)
    for (const data of batchData) {
      try {
        const existing = await prisma.household.findFirst({
          where: {
            numeroordre: data.numeroordre,
            organizationId: orgId,
            deletedAt: null,
          },
        });

        if (existing) {
          await prisma.household.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              phone: data.phone,
              region: data.region,
              village: data.village,
              latitude: data.latitude,
              longitude: data.longitude,
              grappeId: data.grappeId,
              constructionData: data.constructionData,
              version: { increment: 1 },
            },
          });
          updated++;
        } else {
          await prisma.household.create({ data });
          created++;
        }
      } catch (e) {
        if (e.code === 'P2002') {
          // Unique constraint violation — skip
          skipped++;
        } else {
          logger.error(`  Failed household ${data.numeroordre}:`, e.message);
          skipped++;
        }
      }
    }

    logger.info(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${created + updated} processed (${created} created, ${updated} updated)`
    );
  }

  logger.info(
    `Households: ${created} created, ${updated} updated, ${skipped} skipped, ${withGps} with GPS`
  );
  return { created, updated, skipped };
}

// ══════════════════════════════════════════════════════════════
// Step 4: Get real orgId from database
// ══════════════════════════════════════════════════════════════
async function getRealOrgId() {
  try {
    const org = await prisma.organization.findFirst();
    if (org) {
      logger.info(`Found real organization: ${org.name} (${org.id})`);
      return org.id;
    }
  } catch (e) {
    // Organization table might not exist or be accessible
  }
  logger.warn('No organization found, using "default"');
  return 'default';
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════
async function main() {
  logger.info('============================================');
  logger.info('  JSON → GED OS Unified Migration');
  logger.info(`  Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  logger.info('============================================');

  try {
    const orgId = await getRealOrgId();
    logger.info(`Organization ID: ${orgId}`);

    // 1. Regions
    const regionIds = await ensureRegions(orgId);

    // 2. Grappes
    const grappeIds = await ensureGrappes(orgId, regionIds);

    // 3. Households
    await importHouseholds(orgId, regionIds, grappeIds);

    logger.info('============================================');
    logger.info('  Migration complete!');
    logger.info('============================================');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

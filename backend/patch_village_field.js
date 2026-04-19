/**
 * patch_village_field.js
 *
 * One-time migration: copies village/departement/name/phone from the 
 * koboData JSON blob to the dedicated SQL columns on all Household rows.
 *
 * Run with: node patch_village_field.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 [PATCH] Starting village field migration...');

  const households = await prisma.household.findMany({
    where: {
      OR: [
        { village: null },
        { village: '' },
      ]
    },
    select: {
      id: true,
      village: true,
      departement: true,
      region: true,
      name: true,
      phone: true,
      koboData: true,
      owner: true,
    }
  });

  console.log(`📊 Found ${households.length} households with missing village field.`);

  let patched = 0;
  let skipped = 0;

  for (const h of households) {
    const kobo = (h.koboData && typeof h.koboData === 'object') ? h.koboData : {};
    const owner = (h.owner && typeof h.owner === 'object') ? h.owner : {};

    // Extract village: try direct koboData fields first
    const village =
      kobo['village'] ||
      kobo['Village'] ||
      kobo['VILLAGE'] ||
      kobo['localite'] ||
      kobo['Localite'] ||
      kobo['TYPE_DE_VISITE/village_key'] ||
      null;

    const departement =
      kobo['departement'] ||
      kobo['Departement'] ||
      kobo['DEPARTEMENT'] ||
      kobo['TYPE_DE_VISITE/departement_key'] ||
      null;

    const region =
      h.region ||
      kobo['region'] ||
      kobo['Region'] ||
      kobo['TYPE_DE_VISITE/region_key'] ||
      null;

    const name =
      h.name ||
      owner['name'] ||
      owner['nom'] ||
      kobo['TYPE_DE_VISITE/nom_key'] ||
      kobo['nom'] ||
      null;

    const phone =
      h.phone ||
      owner['phone'] ||
      owner['telephone'] ||
      kobo['TYPE_DE_VISITE/telephone_key'] ||
      kobo['telephone'] ||
      null;

    const updateData = {};
    if (village && !h.village) updateData.village = String(village).trim();
    if (departement && !h.departement) updateData.departement = String(departement).trim();
    if (region && !h.region) updateData.region = String(region).trim();
    if (name && !h.name) updateData.name = String(name).trim();
    if (phone && !h.phone) updateData.phone = String(phone).trim();

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    try {
      await prisma.household.update({
        where: { id: h.id },
        data: updateData,
      });
      patched++;
      if (patched % 200 === 0) console.log(`  ✅ Patched ${patched} households...`);
    } catch (e) {
      console.error(`❌ Failed to patch ${h.id}: ${e.message}`);
    }
  }

  console.log(`\n✅ [PATCH] Done!`);
  console.log(`   Patched: ${patched}`);
  console.log(`   Skipped (no data): ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

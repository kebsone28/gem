/**
 * Phase 1 Migration: Transfer Carto* tables data → GED OS unified tables
 *
 * This script migrates:
 * 1. CartoPrestataire + CartoEntrepreneur → Prestataire
 * 2. CartoHouseholdEntry → Household.constructionData (JSON)
 * 3. CartoRegion → Region (deduplicated)
 * 4. CartoGrappe → Grappe (deduplicated)
 * 5. CartoHistory → AuditLog
 *
 * Run: node migrate_carto_to_unified.js
 *
 * SAFETY: This script is READ-ONLY on source tables until migration is verified.
 * After verification, drop Carto* tables in a separate step.
 */

import prisma from './src/core/utils/prisma.js';
import logger from './src/utils/logger.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function migratePrestataires() {
  logger.info('=== Migrating CartoPrestataire → Prestataire ===');

  const cartoPrestas = await prisma.cartoPrestataire.findMany();
  logger.info(`Found ${cartoPrestas.length} CartoPrestataires`);

  let created = 0,
    skipped = 0;

  for (const cp of cartoPrestas) {
    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would create Prestataire: ${cp.nom}`);
      created++;
      continue;
    }

    try {
      await prisma.prestataire.upsert({
        where: { organizationId_nom: { organizationId: 'default', nom: cp.nom } },
        update: {
          entreprise: cp.entreprise,
          societe: cp.societe,
          telephone: cp.telephone,
          email: cp.email,
          adresse: cp.adresse,
          lot: cp.lot,
          region: cp.region,
        },
        create: {
          organizationId: 'default',
          nom: cp.nom,
          entreprise: cp.entreprise,
          societe: cp.societe,
          telephone: cp.telephone,
          email: cp.email,
          adresse: cp.adresse,
          lot: cp.lot,
          region: cp.region,
        },
      });
      created++;
    } catch (e) {
      logger.error(`Failed to migrate prestataire ${cp.nom}:`, e.message);
      skipped++;
    }
  }

  logger.info(`Prestataires: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function migrateEntrepreneurs() {
  logger.info('=== Migrating CartoEntrepreneur → Prestataire ===');

  const cartoEnts = await prisma.cartoEntrepreneur.findMany();
  logger.info(`Found ${cartoEnts.length} CartoEntrepreneurs`);

  let created = 0,
    skipped = 0;

  for (const ce of cartoEnts) {
    const nom = ce.entreprise || `Entreprise-${ce.id}`;

    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would create Prestataire from entrepreneur: ${nom}`);
      created++;
      continue;
    }

    try {
      await prisma.prestataire.upsert({
        where: { organizationId_nom: { organizationId: ce.organizationId, nom } },
        update: {
          lot: ce.lot,
          societe: ce.societe,
          telephone: ce.telephone,
          email: ce.email,
          adresse: ce.adresse,
        },
        create: {
          organizationId: ce.organizationId,
          nom,
          entreprise: ce.entreprise,
          societe: ce.societe,
          telephone: ce.telephone,
          email: ce.email,
          adresse: ce.adresse,
          lot: ce.lot,
        },
      });
      created++;
    } catch (e) {
      logger.error(`Failed to migrate entrepreneur ${nom}:`, e.message);
      skipped++;
    }
  }

  logger.info(`Entrepreneurs → Prestataires: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function migrateHouseholdEntries() {
  logger.info('=== Migrating CartoHouseholdEntry → Household.constructionData ===');

  const entries = await prisma.cartoHouseholdEntry.findMany();
  logger.info(`Found ${entries.length} CartoHouseholdEntries`);

  let updated = 0,
    skipped = 0,
    notFound = 0;

  for (const entry of entries) {
    // Find the household by numeroordre
    const household = await prisma.household.findFirst({
      where: {
        numeroordre: String(entry.householdOrdre),
        organizationId: entry.organizationId,
        deletedAt: null,
      },
    });

    if (!household) {
      notFound++;
      continue;
    }

    const constructionData = {
      ...(household.constructionData || {}),
      lotA: {
        status: entry.lotAStatus,
        justif: entry.lotAJustif,
        updatedAt: entry.lotAUpdatedAt?.toISOString() || null,
      },
      lotB: {
        status: entry.lotBStatus,
        justif: entry.lotBJustif,
        updatedAt: entry.lotBUpdatedAt?.toISOString() || null,
      },
      lotC: {
        status: entry.lotCStatus,
        justif: entry.lotCJustif,
        updatedAt: entry.lotCUpdatedAt?.toISOString() || null,
      },
      conforme: entry.conforme,
      obs: entry.obs,
      cartoMigrated: true,
      cartoEntryId: entry.id,
    };

    if (DRY_RUN) {
      logger.info(
        `[DRY-RUN] Would update Household ${household.id} (${household.numeroordre}) constructionData`
      );
      updated++;
      continue;
    }

    try {
      await prisma.household.update({
        where: { id: household.id },
        data: { constructionData, version: { increment: 1 } },
      });
      updated++;
    } catch (e) {
      logger.error(`Failed to update household ${household.numeroordre}:`, e.message);
      skipped++;
    }
  }

  logger.info(`HouseholdEntries: ${updated} migrated, ${skipped} failed, ${notFound} not found`);
  return { updated, skipped, notFound };
}

async function migrateRegions() {
  logger.info('=== Migrating CartoRegion → Region ===');

  const cartoRegions = await prisma.cartoRegion.findMany();
  logger.info(`Found ${cartoRegions.length} CartoRegions`);

  let created = 0,
    existing = 0;

  for (const cr of cartoRegions) {
    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would ensure Region: ${cr.name}`);
      created++;
      continue;
    }

    try {
      const existingRegion = await prisma.region.findFirst({ where: { name: cr.name } });
      if (existingRegion) {
        existing++;
        continue;
      }

      await prisma.region.create({ data: { name: cr.name } });
      created++;
    } catch (e) {
      logger.error(`Failed to create region ${cr.name}:`, e.message);
    }
  }

  logger.info(`Regions: ${created} created, ${existing} already existed`);
  return { created, existing };
}

async function migrateGrapes() {
  logger.info('=== Migrating CartoGrappe → Grappe ===');

  const cartoGrappe = await prisma.cartoGrappe.findMany({
    include: { region: true },
  });
  logger.info(`Found ${cartoGrappe.length} CartoGrappe`);

  let created = 0,
    skipped = 0;

  for (const cg of cartoGrappe) {
    // Get the organization ID - find first org if not set
    const orgId = cg.organizationId || 'default';
    const regionName = cg.region?.name || `Region-${cg.regionId}`;

    if (DRY_RUN) {
      logger.info(`[DRY-RUN] Would ensure Grappe: ${cg.grappeKey} (${regionName})`);
      created++;
      continue;
    }

    try {
      // Find the GED OS Region
      const region = await prisma.region.findFirst({ where: { name: regionName } });
      if (!region) {
        logger.warn(`Region ${regionName} not found for grappe ${cg.grappeKey}, skipping`);
        skipped++;
        continue;
      }

      const grappeName = cg.grappeKey;

      await prisma.grappe.upsert({
        where: { name_regionId: { name: grappeName, regionId: region.id } },
        update: { organizationId: orgId },
        create: {
          name: grappeName,
          regionId: region.id,
          organizationId: orgId,
        },
      });
      created++;
    } catch (e) {
      logger.error(`Failed to create grappe ${cg.grappeKey}:`, e.message);
      skipped++;
    }
  }

  logger.info(`Grappe: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function migrateHistory() {
  logger.info('=== Migrating CartoHistory → AuditLog ===');

  const history = await prisma.cartoHistory.findMany({
    orderBy: { createdAt: 'asc' },
  });
  logger.info(`Found ${history.length} CartoHistory entries`);

  let created = 0,
    skipped = 0;

  for (const h of history) {
    if (DRY_RUN) {
      created++;
      continue;
    }

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: h.organizationId || 'default',
          userId: null,
          action: 'STATUS_CHANGE',
          entity: 'Household',
          entityId: String(h.householdOrdre),
          metadata: {
            nom: h.nom,
            village: h.village,
            region: h.region,
            lot: h.lot,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            justif: h.justif,
            userName: h.userName,
            source: 'carto_migration',
          },
        },
      });
      created++;
    } catch (e) {
      skipped++;
    }
  }

  logger.info(`History → AuditLog: ${created} created, ${skipped} failed`);
  return { created, skipped };
}

async function main() {
  logger.info('==========================================');
  logger.info('  PHASE 1: Carto* → GED OS Unified Migration');
  logger.info(`  Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  logger.info('==========================================');

  try {
    // 1. Prestataires
    await migratePrestataires();

    // 2. Entrepreneurs → Prestataires
    await migrateEntrepreneurs();

    // 3. Regions
    await migrateRegions();

    // 4. Grappes
    await migrateGrapes();

    // 5. Household Entries → constructionData
    await migrateHouseholdEntries();

    // 6. History → AuditLog
    await migrateHistory();

    logger.info('==========================================');
    logger.info('  Migration complete!');
    logger.info('==========================================');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

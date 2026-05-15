#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function consolidateOrganizations() {
  try {
    console.log('🔍 Checking for duplicate organizations...\n');

    // Find organizations with same name
    const dups = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count, array_agg(id) as ids
      FROM "Organization"
      GROUP BY name
      HAVING COUNT(*) > 1
    `;

    if (dups.length === 0) {
      console.log('✅ No duplicate organizations found');
      return;
    }

    console.log(`⚠️  Found ${dups.length} duplicate organization(s):\n`);

    for (const dup of dups) {
      console.log(`Organization: ${dup.name}`);
      console.log(`  Duplicates: ${dup.count}`);

      const orgs = await prisma.$queryRaw`
        SELECT id, slug, createdAt FROM "Organization"
        WHERE name = ${dup.name}
        ORDER BY createdAt ASC
      `;

      console.log(`  IDs (oldest to newest):`);
      orgs.forEach((org, i) => {
        const isKeep = i === 0 ? ' ← KEEP' : ' ← DELETE';
        console.log(`    [${i}] ${org.id} (${org.slug}) - ${org.createdAt}${isKeep}`);
      });

      if (orgs.length > 1) {
        const keepId = orgs[0].id;  // Keep oldest
        const deleteIds = orgs.slice(1).map(o => o.id);

        console.log(`\n  ➡️  Merging ${orgs.length - 1} secondary org(s) into primary (${keepId})...`);

        for (const delId of deleteIds) {
          // Migrate all users
          await prisma.$executeRaw`
            UPDATE "User" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all projects
          await prisma.$executeRaw`
            UPDATE "Project" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all teams
          await prisma.$executeRaw`
            UPDATE "Team" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all grappes
          await prisma.$executeRaw`
            UPDATE "Grappe" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all missions
          await prisma.$executeRaw`
            UPDATE "Mission" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all households
          await prisma.$executeRaw`
            UPDATE "Household" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all documents
          await prisma.$executeRaw`
            UPDATE "Document" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all kobo submissions
          await prisma.$executeRaw`
            UPDATE "InternalKoboSubmission" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate all formations
          await prisma.$executeRaw`
            UPDATE "FormationModule" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate performance logs
          await prisma.$executeRaw`
            UPDATE "PerformanceLog" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate sync logs
          await prisma.$executeRaw`
            UPDATE "SyncLog" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Migrate audit logs
          await prisma.$executeRaw`
            UPDATE "AuditLog" SET "organizationId" = ${keepId}
            WHERE "organizationId" = ${delId}
          `;

          // Delete the secondary organization
          await prisma.$executeRaw`
            DELETE FROM "Organization" WHERE id = ${delId}
          `;

          console.log(`    ✅ Migrated and deleted ${delId}`);
        }

        console.log(`  ✅ Consolidation complete for ${dup.name}\n`);
      }
    }

    console.log('✅ All duplicate organizations consolidated!');

    // Show final state
    const finals = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count
      FROM "Organization"
      GROUP BY name
    `;

    console.log('\n📊 Final organization state:');
    finals.forEach(o => console.log(`  - ${o.name}: ${o.count}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

consolidateOrganizations();

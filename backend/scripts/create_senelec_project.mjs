#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function createSupervisonSenelecProject() {
  try {
    console.log('🌱 Creating "Supervision Senelec" project...\n');

    // Get first organization with minimal select
    const org = await prisma.$queryRaw`
      SELECT id, name, slug FROM "Organization" LIMIT 1
    `;

    if (org.length === 0) {
      console.error('❌ No organization found. Run create_admin_local.mjs first.');
      process.exit(1);
    }

    const orgId = org[0].id;
    const orgName = org[0].name;

    // Check if project already exists
    const existing = await prisma.$queryRaw`
      SELECT id, "templateKey" FROM "Project" WHERE name = 'Supervision Senelec' AND "organizationId" = ${orgId}
    `;

    if (existing.length > 0) {
      console.log('✅ Project "Supervision Senelec" already exists');
      console.log(`   ID: ${existing[0].id}`);
      console.log(`   Template: ${existing[0].templateKey || 'none'}`);
    } else {
      // Create project using raw SQL to avoid schema mismatch
      const projectId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "Project" (
          id, "organizationId", name, status, budget, duration, "totalHouses",
          config, version, "updatedAt", "templateKey", "templateVersion"
        ) VALUES (
          ${projectId}, ${orgId}, 'Supervision Senelec', 'ACTIVE', 0, 0, 0,
          '{"client":"SENELEC","assignedUsers":[],"enabledModules":["dashboard","missions","planning","analytics"],"description":"Projet de supervision technique pour Senelec"}'::jsonb,
          1, NOW(), 'supervision-senelec', 1
        )
      `;

      console.log('✅ Created project: Supervision Senelec');
      console.log(`   ID: ${projectId}`);
      console.log(`   Organization: ${orgName}`);
      console.log(`   Template: supervision-senelec`);

      // Create default modules for this project
      const defaultModules = [
        { key: 'dashboard', name: 'Dashboard' },
        { key: 'missions', name: 'Missions' },
        { key: 'planning', name: 'Planning' },
        { key: 'analytics', name: 'Analytics' }
      ];

      for (const mod of defaultModules) {
        const modId = randomUUID();
        await prisma.$executeRaw`
          INSERT INTO "ProjectModule" (
            id, "projectId", key, name, enabled, config, fields
          ) VALUES (
            ${modId}, ${projectId}, ${mod.key}, ${mod.name}, true, '{}'::jsonb, '[]'::jsonb
          )
        `;
      }

      console.log('\n✅ Created default modules:');
      defaultModules.forEach(m => console.log(`   - ${m.name}`));
    }

    console.log('\n✅ Project setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSupervisonSenelecProject();

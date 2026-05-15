#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  try {
    // Query organizations with limited select
    const organizations = await prisma.$queryRaw`
      SELECT id, name, slug FROM "Organization"
    `;

    console.log('🔄 Populating slugs for organizations...\n');

    for (const org of organizations) {
      if (!org.slug) {
        const newSlug = org.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '') + '-' + org.id.substring(0, 8);

        await prisma.$executeRaw`
          UPDATE "Organization" SET "slug" = ${newSlug} WHERE "id" = ${org.id}
        `;

        console.log(`✅ Updated ${org.name} → ${newSlug}`);
      } else {
        console.log(`✅ ${org.name} already has slug: ${org.slug}`);
      }
    }

    // Check Project columns
    const projectCols = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Project'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 Project columns:');
    projectCols.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

    // Add templateKey if missing
    const hasTemplateKey = projectCols.some(col => col.column_name === 'templateKey');
    if (!hasTemplateKey) {
      console.log('\n➕ Adding templateKey column to Project...');
      await prisma.$executeRaw`
        ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "templateKey" TEXT
      `;
      console.log('✅ Added templateKey');
    }

    // Add templateVersion if missing
    const hasTemplateVersion = projectCols.some(col => col.column_name === 'templateVersion');
    if (!hasTemplateVersion) {
      console.log('➕ Adding templateVersion column to Project...');
      await prisma.$executeRaw`
        ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER
      `;
      console.log('✅ Added templateVersion');
    }

    console.log('\n✅ Schema migration complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

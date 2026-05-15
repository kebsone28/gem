#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📝 Running migration: create_template_config_tables...\n');

    const migrationFile = './prisma/migrations/20260512_create_template_config_tables/migration.sql';
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log('✅ Executed statement');
        } catch (err) {
          // Ignore if table already exists
          if (!err.message.includes('already exists')) {
            throw err;
          }
          console.log('⚠️  Table already exists, skipping');
        }
      }
    }

    console.log('\n✅ Migration completed!');

    // Verify tables were created
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('ProjectTemplate', 'ProjectPage', 'ProjectModule')
      AND table_schema = 'public'
    `;

    console.log('\n📊 Created/Verified tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();

#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('📋 Existing tables in database:\n');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();

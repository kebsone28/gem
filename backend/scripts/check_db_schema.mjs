#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check existing columns in Organization
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Organization'
      ORDER BY ordinal_position
    `;

    console.log('📋 Existing Organization columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    // Try a simple query
    console.log('\n🔍 Attempting to query with limited select:');
    const orgCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Organization"`;
    console.log(`  Organization count: ${orgCount[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

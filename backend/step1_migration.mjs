#!/usr/bin/env node
/**
 * Start Migration Process
 * Step 1 of validation: Database setup
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`
╔═══════════════════════════════════════════════════╗
║         🚀 STEP 1: PRISMA MIGRATION START          ║
╚═══════════════════════════════════════════════════╝
`);

// Check if schema was modified
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf-8');

if (schema.includes('model ActionApproval')) {
  console.log('✅ Schema contains ActionApproval model');
} else {
  console.log('❌ Schema missing ActionApproval model');
  process.exit(1);
}

// Check .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
} else {
  console.log('❌ .env file not found');
  process.exit(1);
}

console.log('\n📊 Running: npx prisma migrate dev --name add_action_approval\n');

const prisma = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'add_action_approval'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

prisma.on('close', (code) => {
  if (code === 0) {
    console.log(`
✅ STEP 1 COMPLETE: Database migration successful
   - ActionApproval table created
   - Prisma client generated
   
🔄 NEXT: Generate client types
`);
    
    // Generate client
    const generate = spawn('npx', ['prisma', 'generate'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });
    
    generate.on('close', (genCode) => {
      if (genCode === 0) {
        console.log(`
✅ STEP 1B COMPLETE: Prisma client generated
   - Types updated
   - Ready for testing

🧪 NEXT: Run test suite
`);
        process.exit(0);
      } else {
        console.log(`\n❌ Prisma generate failed`);
        process.exit(1);
      }
    });
  } else {
    console.log(`\n❌ Migration failed with code ${code}`);
    process.exit(1);
  }
});

prisma.on('error', (err) => {
  console.error('❌ Migration error:', err.message);
  process.exit(1);
});

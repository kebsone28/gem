#!/usr/bin/env node
/**
 * Migration Runner
 * Exécute la migration Prisma pour ActionApproval
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..');

console.log('🚀 Running Prisma Migration...');
console.log(`   Directory: ${backendDir}`);

const prisma = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'add_action_approval'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true
});

prisma.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } else {
    console.log(`\n❌ Migration failed with code ${code}`);
    process.exit(1);
  }
});

prisma.on('error', (err) => {
  console.error('❌ Failed to start migration:', err);
  process.exit(1);
});

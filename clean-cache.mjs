#!/usr/bin/env node
/**
 * 🧹 AGGRESSIVE CACHE CLEANER FOR GEM
 * Removes all caches and rebuilt artifacts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('\n🧹 AGGRESSIVE CACHE CLEANUP...\n');

const dirs = [
  'frontend/node_modules/.vite',
  'frontend/dist',
  'frontend/.vite-temp',
  'frontend/.tmp',
  'backend/.vite-temp',
  '.vite-temp',
];

for (const dir of dirs) {
  const fullPath = path.resolve(dir);
  if (fs.existsSync(fullPath)) {
    try {
      execSync(`rmdir /s /q "${fullPath}"`, { shell: 'cmd.exe' });
      console.log(`✅ Deleted: ${dir}`);
    } catch (e) {
      console.log(`⚠️  Could not delete: ${dir}`);
    }
  }
}

console.log('\n✅ Cache cleanup complete!');
console.log('Now run: npm run dev:saas\n');

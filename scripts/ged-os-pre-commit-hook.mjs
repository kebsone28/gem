#!/usr/bin/env node
/**
 * 🔒 GED OS PORT PRE-COMMIT HOOK
 * Prevents accidental commits that modify GED OS's reserved port configurations
 */

import { execSync } from 'child_process';
import fs from 'fs';

const PROTECTED_FILES = [
  'backend/.env',
  'package.json',
  'frontend/vite.config.ts',
  'backend/src/core/config/config.js',
  'backend/src/server.js',
];

const PROTECTED_PATTERNS = [
  { file: 'backend/.env', pattern: /^PORT=8888$/m, name: 'Backend PORT' },
  { file: 'package.json', pattern: /--port 8889/m, name: 'Frontend port' },
  { file: 'frontend/vite.config.ts', pattern: /port: 8889/m, name: 'Vite dev port' },
];

try {
  // Get staged files
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean);

  let hasPortViolation = false;

  for (const file of stagedFiles) {
    if (PROTECTED_FILES.includes(file)) {
      // Get the staged content
      const stagedContent = execSync(`git show :${file}`, { encoding: 'utf-8' });

      // Check if protected patterns are present
      for (const { file: protectedFile, pattern, name } of PROTECTED_PATTERNS) {
        if (file === protectedFile && !pattern.test(stagedContent)) {
          console.error(`\n❌ COMMIT BLOCKED: ${name} has been modified!`);
          console.error(`   File: ${file}`);
          console.error(`   Expected: ${pattern}`);
          hasPortViolation = true;
        }
      }
    }
  }

  if (hasPortViolation) {
    console.error('\n🔒 GED OS ports are protected. Run: npm run validate-ports:fix');
    process.exit(1);
  }
} catch (error) {
  // If git command fails, skip validation (we're not in a git repo)
  // This allows the script to work in CI/CD environments
}

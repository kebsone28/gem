#!/usr/bin/env node
/**
 * 🔒 GEM PORT VALIDATOR
 * This script ensures that GEM's reserved ports (8888, 8889, 8890) are not modified.
 * It runs automatically before dev:saas starts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, '.ged-os-ports.json');
const BACKEND_ENV = path.join(ROOT_DIR, 'backend', '.env');
const VITE_CONFIG = path.join(ROOT_DIR, 'frontend', 'vite.config.ts');
const CONFIG_JS = path.join(ROOT_DIR, 'backend', 'src', 'core', 'config', 'config.js');

// Expected values
const EXPECTED_PORTS = {
  backend: 8888,
  frontend: 8889,
  preview: 8890,
};

const EXPECTED_CORS = [
  'http://localhost:8889',
  'http://127.0.0.1:8889',
  'http://0.0.0.0:8889',
  'http://localhost:8890',
  'http://127.0.0.1:8890',
  'http://localhost:8891',
];

let hasErrors = false;

function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    hasErrors = true;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  checks.forEach(({ name, pattern, shouldExist }) => {
    const exists = pattern.test(content);
    if (shouldExist && !exists) {
      console.error(`❌ ${name} - Expected pattern not found in ${path.basename(filePath)}`);
      hasErrors = true;
    } else if (!shouldExist && exists) {
      console.error(`❌ ${name} - Found unwanted pattern in ${path.basename(filePath)}`);
      hasErrors = true;
    } else if (shouldExist) {
      console.log(`✅ ${name}`);
    }
  });
}

console.log('\n🔒 GEM PORT VALIDATOR - Checking reserved ports...\n');

// Check backend/.env
checkFile(BACKEND_ENV, [
  { name: 'Backend PORT=8888', pattern: /^PORT=8888$/m, shouldExist: true },
  { name: 'Backend CORS includes 8889', pattern: /CORS_ORIGIN=.*8889/m, shouldExist: true },
  { name: 'Backend FRONTEND_URL=8889', pattern: /FRONTEND_URL=.*8889/m, shouldExist: true },
]);

// Check frontend/vite.config.ts
checkFile(VITE_CONFIG, [
  { name: 'Frontend dev port=8889', pattern: /port:\s*8889/m, shouldExist: true },
  { name: 'Frontend preview port=8890', pattern: /port:\s*8890/m, shouldExist: true },
]);

// Check backend/src/core/config/config.js
checkFile(CONFIG_JS, [
  { name: 'CORS includes 8889', pattern: /8889/m, shouldExist: true },
  { name: 'CORS includes 8890', pattern: /8890/m, shouldExist: true },
  { name: 'No old port 5173', pattern: /5173/m, shouldExist: false },
  { name: 'No old port 3000', pattern: /\b3000\b/m, shouldExist: false },
]);

// Check backend/src/server.js
const serverJS = path.join(ROOT_DIR, 'backend', 'src', 'server.js');
checkFile(serverJS, [
  { name: 'Server FRONTEND_URL fallback is 8889', pattern: /http:\/\/localhost:8889/m, shouldExist: true },
]);

// Check package.json
const packageJSON = path.join(ROOT_DIR, 'package.json');
checkFile(packageJSON, [
  { name: 'npm run dev:frontend uses port 8889', pattern: /--port 8889/m, shouldExist: true },
]);

if (hasErrors) {
  console.error('\n🚨 PORT VALIDATION FAILED - Some GEM ports are incorrect!');
  console.error('Please run: npm run validate-ports:fix\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL GEM PORTS ARE CORRECTLY CONFIGURED');
  console.log('   Backend:  http://localhost:8888');
  console.log('   Frontend: http://localhost:8889');
  console.log('   Preview:  http://localhost:8890\n');
}

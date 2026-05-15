#!/usr/bin/env node
/**
 * 🔧 GEM PORT FIXER
 * This script automatically restores GEM's reserved ports if they've been modified.
 * Run this if port validation fails.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const files = {
  backendEnv: path.join(ROOT_DIR, 'backend', '.env'),
  packageJson: path.join(ROOT_DIR, 'package.json'),
  viteConfig: path.join(ROOT_DIR, 'frontend', 'vite.config.ts'),
  configJs: path.join(ROOT_DIR, 'backend', 'src', 'core', 'config', 'config.js'),
  serverJs: path.join(ROOT_DIR, 'backend', 'src', 'server.js'),
};

console.log('🔧 GEM PORT FIXER - Restoring reserved ports...\n');

// Fix backend/.env
function fixBackendEnv() {
  let content = fs.readFileSync(files.backendEnv, 'utf-8');
  
  // Fix PORT
  content = content.replace(/^PORT=\d+$/m, 'PORT=8888');
  
  // Fix CORS_ORIGIN - ensure 8889
  if (!/CORS_ORIGIN.*8889/.test(content)) {
    content = content.replace(
      /CORS_ORIGIN=.*/,
      'CORS_ORIGIN=http://localhost:8889,http://localhost:8890,http://localhost:8891'
    );
  }
  
  // Fix FRONTEND_URL
  if (!content.includes('FRONTEND_URL=')) {
    content = content.replace(
      /^CORS_ORIGIN=.*/m,
      (match) => match + '\nFRONTEND_URL=http://localhost:8889'
    );
  } else {
    content = content.replace(
      /FRONTEND_URL=.*/,
      'FRONTEND_URL=http://localhost:8889'
    );
  }
  
  fs.writeFileSync(files.backendEnv, content, 'utf-8');
  console.log('✅ Fixed: backend/.env');
}

// Fix package.json
function fixPackageJson() {
  let content = fs.readFileSync(files.packageJson, 'utf-8');
  content = content.replace(
    /"dev:frontend":\s*"[^"]*"/,
    '"dev:frontend": "cd frontend && npm run dev -- --host 0.0.0.0 --port 8889"'
  );
  fs.writeFileSync(files.packageJson, content, 'utf-8');
  console.log('✅ Fixed: package.json');
}

// Fix vite.config.ts
function fixViteConfig() {
  let content = fs.readFileSync(files.viteConfig, 'utf-8');
  
  // Fix dev server port
  content = content.replace(
    /server:\s*{[^}]*port:\s*\d+/s,
    (match) => match.replace(/port:\s*\d+/, 'port: 8889')
  );
  
  // Fix preview port
  content = content.replace(
    /preview:\s*{[^}]*port:\s*\d+/s,
    (match) => match.replace(/port:\s*\d+/, 'port: 8890')
  );
  
  fs.writeFileSync(files.viteConfig, content, 'utf-8');
  console.log('✅ Fixed: frontend/vite.config.ts');
}

// Fix config.js
function fixConfigJs() {
  let content = fs.readFileSync(files.configJs, 'utf-8');
  
  // Replace old CORS origins
  content = content.replace(
    /const localCorsOrigins = \[[^\]]*\];/s,
    `const localCorsOrigins = [
    'http://localhost:8889',
    'http://127.0.0.1:8889',
    'http://0.0.0.0:8889',
    'http://localhost:8890',
    'http://127.0.0.1:8890',
    'http://localhost:8891'
];`
  );
  
  fs.writeFileSync(files.configJs, content, 'utf-8');
  console.log('✅ Fixed: backend/src/core/config/config.js');
}

// Fix server.js
function fixServerJs() {
  let content = fs.readFileSync(files.serverJs, 'utf-8');
  content = content.replace(
    /process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:\d+'/,
    "process.env.FRONTEND_URL || 'http://localhost:8889'"
  );
  fs.writeFileSync(files.serverJs, content, 'utf-8');
  console.log('✅ Fixed: backend/src/server.js');
}

try {
  fixBackendEnv();
  fixPackageJson();
  fixViteConfig();
  fixConfigJs();
  fixServerJs();
  
  console.log('\n✅ ALL GEM PORTS RESTORED');
  console.log('   Backend:  http://localhost:8888');
  console.log('   Frontend: http://localhost:8889');
  console.log('   Preview:  http://localhost:8890\n');
  console.log('You can now run: npm run dev:saas\n');
} catch (error) {
  console.error('❌ Error restoring ports:', error.message);
  process.exit(1);
}

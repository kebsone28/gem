#!/usr/bin/env node
/**
 * 🚀 GEM COMPLETE STARTUP & LOGIN TEST
 * Launches npm run dev:saas and automatically tests login
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8888/api';
const credentials = {
  email: 'admingem',
  password: 'suprime',
  twoFactorCode: 'CORAN'
};

console.log('\n' + '='.repeat(60));
console.log('🚀 GEM SAAS - COMPLETE STARTUP & LOGIN TEST');
console.log('='.repeat(60) + '\n');

// Cleanup cache first
console.log('🧹 Cleaning cache...');
try {
  const dirs = [
    'frontend/node_modules/.vite',
    'frontend/dist',
    '.vite-temp'
  ];
  
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      execSync(`rmdir /s /q "${dir}"`, { shell: 'cmd.exe', stdio: 'ignore' }).catch(() => {});
    }
  }
  console.log('✅ Cache cleaned\n');
} catch (e) {
  console.log('⚠️  Could not clean cache (continuing anyway)\n');
}

// Step 1: Launch dev server
console.log('⏳ Starting npm run dev:saas...');
const server = spawn('npm', ['run', 'dev:saas'], {
  shell: true,
  stdio: 'inherit'
});

let serverReady = false;

// Wait for server to be ready
console.log('\n⏳ Waiting 20 seconds for server to start...');
await new Promise(resolve => setTimeout(resolve, 20000));

// Step 2: Test backend connectivity
console.log('\n🔍 Testing backend connectivity...');
async function testBackend() {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/api/ping`);
    const data = await response.json();
    console.log('✅ Backend is responding:', data.msg);
    return true;
  } catch (error) {
    console.error('❌ Backend not responding:', error.message);
    return false;
  }
}

const backendReady = await testBackend();

if (!backendReady) {
  console.error('\n🚨 Backend failed to start. Check the logs above.');
  process.exit(1);
}

// Step 3: Test login
console.log('\n' + '='.repeat(60));
console.log('🔐 TESTING LOGIN');
console.log('='.repeat(60) + '\n');

console.log('📝 Credentials:');
console.log(`   Email: ${credentials.email}`);
console.log(`   Password: ${credentials.password}`);
console.log(`   2FA: ${credentials.twoFactorCode}\n`);

async function testLogin() {
  try {
    // Step 1: Initial login
    console.log('⏳ Step 1: Attempting initial login...');
    let response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.user?.requires2FA) {
      console.log('✅ Initial login successful, 2FA required');
      console.log(`   User: ${data.user.email}`);
      console.log(`   Role: ${data.user.role}`);
      console.log(`   Question: ${data.user.securityQuestion}\n`);

      // Step 2: Verify 2FA
      console.log('⏳ Step 2: Verifying 2FA answer...');
      response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          twoFactorCode: credentials.twoFactorCode,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`2FA verification failed: ${response.status} ${response.statusText}`);
      }

      const data2fa = await response.json();
      console.log('✅ 2FA verification successful!\n');
      
      console.log('📋 USER DATA:');
      console.log(JSON.stringify(data2fa.user, null, 2));
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ SUCCESS! LOGIN TEST PASSED');
      console.log('='.repeat(60));
      console.log('\n✨ GEM is now running and ready to use!');
      console.log('\n📍 Access points:');
      console.log('   • Frontend: http://localhost:8889');
      console.log('   • Backend API: http://localhost:8888');
      console.log('   • Login: admingem / suprime (2FA: CORAN)');
      console.log('\n' + '='.repeat(60) + '\n');
    } else {
      console.log('✅ Login successful (no 2FA required)\n');
      console.log('📋 USER DATA:');
      console.log(JSON.stringify(data.user, null, 2));
      console.log('\n✅ LOGIN TEST PASSED\n');
    }
  } catch (error) {
    console.error('\n❌ LOGIN TEST FAILED');
    console.error(`Error: ${error.message}`);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check backend logs (scroll up)');
    console.error('   2. Ensure database is running');
    console.error('   3. Try: npm run validate-ports\n');
    process.exit(1);
  }
}

await testLogin();

// Keep server running
console.log('📡 Dev server is running. Press Ctrl+C to stop.\n');
server.on('exit', () => process.exit(0));

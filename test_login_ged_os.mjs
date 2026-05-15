#!/usr/bin/env node
/**
 * 🔐 GEM LOGIN TEST
 * Tests the login with credentials: admingem / suprime / CORAN
 * Uses native fetch (no axios needed)
 */

const API_URL = 'http://localhost:8888/api';
const credentials = {
  email: 'admingem',
  password: 'suprime',
  twoFactorCode: 'CORAN'
};

async function testLogin() {
  try {
    console.log('\n🚀 Testing GEM Login...\n');
    console.log(`📝 Credentials:`);
    console.log(`   Email: ${credentials.email}`);
    console.log(`   Password: ${credentials.password}`);
    console.log(`   2FA Code: ${credentials.twoFactorCode}\n`);

    // Step 1: Initial login
    console.log('⏳ Step 1: Initial login attempt...');
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
      console.log('📋 User Data:');
      console.log(JSON.stringify(data2fa.user, null, 2));
      console.log('\n✅ LOGIN TEST PASSED!\n');
      console.log('✨ You can now access GEM at: http://localhost:8889\n');
    } else {
      console.log('✅ Login successful (no 2FA required)\n');
      console.log('📋 User Data:');
      console.log(JSON.stringify(data.user, null, 2));
      console.log('\n✅ LOGIN TEST PASSED!\n');
    }
  } catch (error) {
    console.error('\n❌ LOGIN TEST FAILED\n');
    console.error(`Error: ${error.message}`);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('   1. Make sure npm run dev:saas is running');
    console.error('   2. Check backend is on port 8888');
    console.error('   3. Check database connection');
    console.error('   4. Run: npm run validate-ports\n');
    process.exit(1);
  }
}

testLogin();

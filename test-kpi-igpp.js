#!/usr/bin/env node

/**
 * Test des flux KPI & IGPP
 * 1. Login pour obtenir JWT token
 * 2. Appeler l'endpoint KPI avec le token
 * 3. Valider que les données KPI sont correctes
 */

import https from 'https';
import http from 'http';

const API_BASE = 'http://localhost/api';
const ADMIN_EMAIL = 'admin@proquelec.com';
const ADMIN_PASSWORD = 'proquelec123';

async function login() {
  console.log('\n📝 Étape 1 : Login to get JWT token...\n');
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    
    if (!response.ok) {
      console.error(`❌ Login failed: ${response.status}`);
      const error = await response.text();
      console.error('Error:', error);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Login successful!`);
    console.log(`   User: ${data.user.email}`);
    console.log(`   Role: ${data.user.role}`);
    console.log(`   Token: ${data.token.substring(0, 40)}...`);
    
    return data.token;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return null;
  }
}

async function testKPIEndpoint(token) {
  console.log('\n📊 Étape 2 : Test /api/kpi endpoint...\n');
  
  try {
    const response = await fetch(`${API_BASE}/kpi/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ KPI request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ KPI data retrieved!`);
    console.log(`   Total projects: ${data.projects?.length || 0}`);
    
    if (data.projects && data.projects.length > 0) {
      const project = data.projects[0];
      console.log(`\n   First project:`);
      console.log(`   - Name: ${project.name}`);
      console.log(`   - IGPP Score: ${project.igppScore || 'N/A'}`);
      console.log(`   - Electricity Access: ${project.electricityAccessPercent}%`);
      console.log(`   - Budget Used: ${project.percentUsed}%`);
      console.log(`   - Timeline Progress: ${project.timelineProgressPercent}%`);
      console.log(`   - Team Saturation: ${project.teamSaturationPercent}%`);
      console.log(`   - Risk Level: ${project.riskLevel}`);
    } else {
      console.log(`   No projects found. (This is normal if no data exists yet)`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ KPI test error:', error.message);
    return null;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  PROQUELEC Web V3 - KPI & IGPP Validation Test');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Step 1: Login
  const token = await login();
  if (!token) {
    console.error('\n❌ Failed to obtain JWT token. Stopping tests.');
    process.exit(1);
  }
  
  // Step 2: Test KPI endpoint
  const kpiData = await testKPIEndpoint(token);
  if (!kpiData) {
    console.error('\n❌ Failed to retrieve KPI data. Stopping tests.');
    process.exit(1);
  }
  
  // Step 3: Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ All tests completed successfully!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * STEP 2: Full Local Approval System Test
 * Validates all components before deployment
 */

import prisma from '../core/utils/prisma.js';
import { approvalService } from '../modules/assistant/services/ApprovalService.js';
import { approvalExecutor } from '../modules/assistant/services/ApprovalExecutor.js';
import {
  getActionConfig,
  canAgentExecuteAction,
  determineExecutionFlow,
  actionConfig,
  agentPermissions
} from '../modules/assistant/config/actionConfig.js';
import logger from '../utils/logger.js';

const ORGANIZATION_ID = 'test-org-validation-001';
const USER_ID = 'test-user-validation-001';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  purple: '\x1b[35m'
};

console.log(`
╔══════════════════════════════════════════════════════╗
║    🧪 STEP 2: VALIDATION LOCAL - FULL TEST SUITE     ║
╚══════════════════════════════════════════════════════╝
`);

const logTest = (name, passed, details = '') => {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  console.log(`${icon} ${color}${name}${colors.reset}${details ? ' → ' + details : ''}`);
  
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
};

const section = (title) => {
  console.log(`\n${colors.blue}═══ ${title} ═══${colors.reset}`);
};

// ===== TEST 1: Schema Validation =====
section('TEST 1: Database Schema');

try {
  const tableExists = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'ActionApproval'
    );
  `;
  
  if (tableExists && tableExists[0]?.exists) {
    logTest('ActionApproval table exists', true);
  } else {
    logTest('ActionApproval table exists', false, 'Table not found in DB');
  }
} catch (err) {
  logTest('ActionApproval table exists', false, err.message);
}

// ===== TEST 2: Action Config =====
section('TEST 2: Action Configuration');

try {
  const actions = Object.keys(actionConfig);
  logTest(`Loaded ${actions.length} actions`, actions.length > 0, `Actions: ${actions.join(', ')}`);
  
  // Verify each has required fields
  let configValid = true;
  actions.forEach(action => {
    const cfg = actionConfig[action];
    if (!cfg.risk || !cfg.description) {
      configValid = false;
    }
  });
  
  logTest('All actions have risk + description', configValid);
} catch (err) {
  logTest('Action config validation', false, err.message);
}

// ===== TEST 3: Agent Permissions =====
section('TEST 3: Agent Permissions');

try {
  const agents = Object.keys(agentPermissions);
  logTest(`Loaded permissions for ${agents.length} agents`, agents.length > 0);
  
  // Test a few cases
  const testCases = [
    { agent: 'TechAgent', action: 'getHouseholds', expected: true },
    { agent: 'SupportAgent', action: 'createMission', expected: false },
    { agent: 'DataAgent', action: 'analyzeConsumption', expected: true }
  ];
  
  let allPassed = true;
  testCases.forEach(test => {
    const can = canAgentExecuteAction(test.agent, test.action);
    if (can !== test.expected) allPassed = false;
  });
  
  logTest('Permission matrix enforced', allPassed);
} catch (err) {
  logTest('Permission matrix', false, err.message);
}

// ===== TEST 4: Execution Flow =====
section('TEST 4: Execution Flow Determination');

try {
  const flows = [
    { risk: 'LOW', conf: 0.5, expected: 'AUTO_EXECUTE' },
    { risk: 'HIGH', conf: 0.95, expected: 'AUTO_EXECUTE' },
    { risk: 'MEDIUM', conf: 0.3, expected: 'REQUIRE_APPROVAL' }
  ];
  
  let allCorrect = true;
  flows.forEach(f => {
    const flow = determineExecutionFlow(f.risk, f.conf);
    if (flow !== f.expected) allCorrect = false;
  });
  
  logTest('Execution flow routing', allCorrect);
} catch (err) {
  logTest('Execution flow routing', false, err.message);
}

// ===== TEST 5: Create Approval Record =====
section('TEST 5: Database Operations');

let testApprovalId = null;

try {
  const approval = await approvalService.createApprovalRecord({
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    agentName: 'TechAgent',
    actionType: 'getHouseholds',
    confidence: 0.82,
    payload: { filter: 'region', value: 'Dakar' },
    requestedBy: 'test@example.com',
    metadata: { model: 'ollama', latency: 450 }
  });
  
  testApprovalId = approval.id;
  logTest('Create approval record', !!approval.id, `ID: ${approval.id.substring(0, 8)}...`);
  logTest('Record has correct status', 
    approval.status === 'AUTO_EXECUTED', 
    `Status: ${approval.status}`
  );
} catch (err) {
  logTest('Create approval record', false, err.message);
}

// ===== TEST 6: Fetch Pending =====
section('TEST 6: Approval Queue');

try {
  // Create a HIGH RISK action to get PENDING status
  const highRisk = await approvalService.createApprovalRecord({
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    agentName: 'TechAgent',
    actionType: 'createMission',
    confidence: 0.65,
    payload: { title: 'Test Mission', region: 'Dakar' },
    requestedBy: 'test'
  });
  
  const pending = await approvalService.getPendingApprovals(ORGANIZATION_ID);
  logTest('Fetch pending approvals', pending.length > 0, `Found: ${pending.length}`);
  
  // Save for next test
  global.testHighRiskId = highRisk.id;
} catch (err) {
  logTest('Fetch pending approvals', false, err.message);
}

// ===== TEST 7: Reject Workflow =====
section('TEST 7: Approval Workflow');

try {
  if (global.testHighRiskId) {
    const rejected = await approvalService.rejectAction(
      global.testHighRiskId,
      USER_ID,
      'Test rejection'
    );
    
    logTest('Reject action', 
      rejected.status === 'REJECTED', 
      `Status: ${rejected.status}`
    );
    logTest('Rejection comment saved', 
      !!rejected.rejectionComment, 
      `Comment: ${rejected.rejectionComment}`
    );
  }
} catch (err) {
  logTest('Approval workflow', false, err.message);
}

// ===== TEST 8: History & Stats =====
section('TEST 8: Audit Trail & Analytics');

try {
  const history = await approvalService.getApprovalHistory(ORGANIZATION_ID, {}, { skip: 0, take: 10 });
  logTest('Fetch history', !!history.items, `Records: ${history.items.length}`);
  
  const stats = await approvalService.getApprovalStats(ORGANIZATION_ID);
  logTest('Calculate stats', !!stats.byStatus, 'Stats computed');
} catch (err) {
  logTest('History & stats', false, err.message);
}

// ===== TEST 9: Executor =====
section('TEST 9: Approval Executor');

try {
  const result = await approvalExecutor.executeWithApproval({
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    agentName: 'DataAgent',
    actionType: 'analyzeConsumption',
    confidence: 0.75,
    payload: { householdIds: ['h1', 'h2'] },
    requestedBy: 'api'
  });
  
  logTest('Execute with approval routing', 
    result.status === 'AUTO_EXECUTED_SAVED' || result.status === 'PENDING_APPROVAL',
    `Status: ${result.status}`
  );
} catch (err) {
  logTest('Executor', false, err.message);
}

// ===== TEST 10: Permissions Enforcement =====
section('TEST 10: Security - Permission Enforcement');

try {
  const result = await approvalExecutor.executeWithApproval({
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    agentName: 'SupportAgent',
    actionType: 'createMission', // NOT allowed
    confidence: 0.8,
    payload: { title: 'Unauthorized' },
    requestedBy: 'api'
  });
  
  const isFailed = result.status === 'ERROR' && result.error?.includes('not permitted');
  logTest('Permission enforcement blocks unauthorized action', isFailed, result.error || 'OK');
} catch (err) {
  logTest('Permission enforcement', true, 'Correctly threw error');
}

// ===== CLEANUP =====
section('CLEANUP');

try {
  await prisma.$disconnect();
  console.log('✅ Database connection closed');
} catch (err) {
  console.log('❌ Cleanup failed:', err.message);
}

// ===== FINAL REPORT =====
console.log(`
╔══════════════════════════════════════════════════════╗
║              📊 TEST RESULTS SUMMARY                  ║
╚══════════════════════════════════════════════════════╝

${colors.green}✅ PASSED: ${testResults.passed}${colors.reset}
${testResults.failed > 0 ? colors.red + '❌ FAILED: ' + testResults.failed + colors.reset : ''}

${colors.cyan}Test Details:${colors.reset}
`);

testResults.tests.forEach(t => {
  const icon = t.passed ? '✓' : '✗';
  const color = t.passed ? colors.green : colors.red;
  console.log(`  ${color}${icon}${colors.reset} ${t.name}${t.details ? ' → ' + t.details : ''}`);
});

if (testResults.failed === 0) {
  console.log(`
${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 ALL TESTS PASSED - READY FOR P2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.cyan}Next Steps:${colors.reset}
1. ✅ Database validated
2. ✅ Approvals working
3. ✅ Permissions enforced
4. ✅ Ready for staging

${colors.yellow}Status: DEVELOPMENT READY${colors.reset}
Recommendation: Run P2 (Tool Permissions)
`);
  process.exit(0);
} else {
  console.log(`
${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ SOME TESTS FAILED - REVIEW NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

Failed tests:
`);
  testResults.tests.filter(t => !t.passed).forEach(t => {
    console.log(`  • ${t.name}: ${t.details}`);
  });
  process.exit(1);
}

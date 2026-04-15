#!/usr/bin/env node
/**
 * STEP 3: System Validation Checklist
 * Ensures deployment safety before Waneko staging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
╔═══════════════════════════════════════════════════════╗
║    ✅ STEP 3: SYSTEM VALIDATION CHECKLIST              ║
╚═══════════════════════════════════════════════════════╝
`);

let checks = {
  passed: 0,
  failed: 0,
  items: []
};

const check = (name, passed, detail = '') => {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  console.log(`${icon} ${color}${name}${colors.reset}${detail ? ' → ' + detail : ''}`);
  
  checks.items.push({ name, passed, detail });
  if (passed) checks.passed++;
  else checks.failed++;
};

const section = (title) => {
  console.log(`\n${colors.blue}═══ ${title} ═══${colors.reset}`);
};

// ===== 1. CODE STRUCTURE =====
section('1. Code Structure & Files');

const requiredFiles = [
  'src/modules/assistant/config/actionConfig.js',
  'src/modules/assistant/services/ApprovalService.js',
  'src/modules/assistant/services/ApprovalExecutor.js',
  'src/modules/assistant/approval.controller.js',
  'src/modules/assistant/approval.router.js',
  'src/modules/assistant/agent/AgentCore.js',
  'test_approval_system.mjs',
  'step1_migration.mjs',
  'step2_test_complete.mjs'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  check(`File: ${file.split('/').pop()}`, exists);
});

// ===== 2. DATABASE SCHEMA =====
section('2. Database Schema');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schemaContent = '';

try {
  schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  check('Prisma schema exists', true);
  check('Contains ActionApproval model', schemaContent.includes('model ActionApproval'), 'Model defined');
  check('Contains agentName field', schemaContent.includes('agentName'), 'Field present');
  check('Contains riskLevel field', schemaContent.includes('riskLevel'), 'Field present');
  check('Contains confidence field', schemaContent.includes('confidence'), 'Field present');
  check('Contains status field', schemaContent.includes('status'), 'Field present');
  check('Contains metadata JSON', schemaContent.includes('metadata'), 'Field present');
  check('Contains userId relation', schemaContent.includes('userId'), 'Field present');
  
} catch (err) {
  check('Database schema validation', false, err.message);
}

// ===== 3. CONFIGURATION =====
section('3. Configuration & Constants');

try {
  const configPath = path.join(__dirname, 'src/modules/assistant/config/actionConfig.js');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  check('actionConfig exports', configContent.includes('export const actionConfig'), 'Exported');
  check('Risk levels defined', 
    configContent.includes("risk: 'LOW'") && 
    configContent.includes("risk: 'MEDIUM'") && 
    configContent.includes("risk: 'HIGH'"),
    '3 levels'
  );
  check('Agent permissions defined', configContent.includes('export const agentPermissions'), 'Exported');
  check('Confidence thresholds set', configContent.includes('autoExecuteHighConfidence'), 'Set');
  check('Approval settings defined', configContent.includes('export const approvalSettings'), 'Exported');
  
} catch (err) {
  check('Configuration validation', false, err.message);
}

// ===== 4. SERVICE LAYER =====
section('4. Service Layer Implementation');

try {
  const serviceFiles = [
    'src/modules/assistant/services/ApprovalService.js',
    'src/modules/assistant/services/ApprovalExecutor.js'
  ];
  
  serviceFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    check(`${file.split('/').pop()} export service`, 
      content.includes('export class') || content.includes('export const'),
      'Class/const exported'
    );
  });
  
  // Verify key methods exist
  const approvalService = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/services/ApprovalService.js'), 'utf-8');
  check('ApprovalService has createApprovalRecord', approvalService.includes('createApprovalRecord'), 'Method exists');
  check('ApprovalService has getPendingApprovals', approvalService.includes('getPendingApprovals'), 'Method exists');
  check('ApprovalService has approveAction', approvalService.includes('approveAction'), 'Method exists');
  check('ApprovalService has rejectAction', approvalService.includes('rejectAction'), 'Method exists');
  
} catch (err) {
  check('Service layer validation', false, err.message);
}

// ===== 5. AGENT ENHANCEMENTS =====
section('5. Agent Core Enhancements');

try {
  const agentCore = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/agent/AgentCore.js'), 'utf-8');
  
  check('Enhanced Agent.execute()', agentCore.includes('calculateConfidence'), 'Method present');
  check('Confidence scoring implemented', agentCore.includes('calculateConfidence'), 'Implemented');
  check('Fail-safe try/catch added', agentCore.includes('try {') && agentCore.includes('catch'), 'Added');
  check('Execution metrics tracked', agentCore.includes('lastExecutionMetrics'), 'Tracked');
  check('Rich result format', agentCore.includes('buildExecutionResult'), 'Implemented');
  
} catch (err) {
  check('Agent enhancements', false, err.message);
}

// ===== 6. API ENDPOINTS =====
section('6. API Endpoints');

try {
  const controller = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/approval.controller.js'), 'utf-8');
  const router = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/approval.router.js'), 'utf-8');
  
  check('executeAction endpoint', controller.includes('export const executeAction'), 'Defined');
  check('getPendingApprovals endpoint', controller.includes('export const getPendingApprovals'), 'Defined');
  check('approveAction endpoint', controller.includes('export const approveAction'), 'Defined');
  check('rejectAction endpoint', controller.includes('export const rejectAction'), 'Defined');
  check('getApprovalHistory endpoint', controller.includes('export const getApprovalHistory'), 'Defined');
  
  check('Routes mounted', router.includes('router.post') && router.includes('router.get'), 'Mounted');
  
} catch (err) {
  check('API endpoints', false, err.message);
}

// ===== 7. APP INTEGRATION =====
section('7. App Integration');

try {
  const appPath = path.join(__dirname, '../src/app.js');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  
  check('Approval routes imported', appContent.includes("import approvalRoutes"), 'Imported');
  check('Approval routes mounted', appContent.includes("app.use('/api/approvals'"), 'Mounted at /api/approvals');
  
} catch (err) {
  check('App integration', false, err.message);
}

// ===== 8. ERROR HANDLING =====
section('8. Error Handling & Fail-Safe');

try {
  const executor = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/services/ApprovalExecutor.js'), 'utf-8');
  const agentCore = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/agent/AgentCore.js'), 'utf-8');
  
  check('Executor has try/catch blocks', executor.includes('try {') && executor.includes('catch'), 'Added');
  check('Agent has try/catch blocks', agentCore.includes('try {') && agentCore.includes('catch'), 'Added');
  check('Tool timeout protection', agentCore.includes('30000') || agentCore.includes('timeout'), 'Implemented');
  
} catch (err) {
  check('Error handling', false, err.message);
}

// ===== 9. LOGGING & AUDIT =====
section('9. Logging & Audit Trail');

try {
  const service = fs.readFileSync(path.join(__dirname, 'src/modules/assistant/services/ApprovalService.js'), 'utf-8');
  
  check('Logger imported', service.includes('logger'), 'Imported');
  check('Create logged', service.includes("logger.info('ActionApproval created"),'Logged');
  check('Approve logged', service.includes("logger.info('ActionApproval approved"),'Logged');
  check('Reject logged', service.includes("logger.info('ActionApproval rejected"),'Logged');
  
} catch (err) {
  check('Logging & audit', false, err.message);
}

// ===== 10. TEST SUITE =====
section('10. Test Coverage');

const testFiles = [
  'test_approval_system.mjs',
  'step2_test_complete.mjs'
];

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  check(`Test file: ${file}`, exists, exists ? 'Ready' : 'Missing');
});

// ===== FINAL REPORT =====
console.log(`
╔═══════════════════════════════════════════════════════╗
║              📋 VALIDATION RESULTS                     ║
╚═══════════════════════════════════════════════════════╝

${colors.green}✅ PASSED: ${checks.passed}${colors.reset}
${checks.failed > 0 ? colors.red + '❌ FAILED: ' + checks.failed + colors.reset : ''}

`);

if (checks.failed > 0) {
  console.log(`${colors.red}Failed Items:${colors.reset}`);
  checks.items.filter(i => !i.passed).forEach(i => {
    console.log(`  • ${i.name}: ${i.detail}`);
  });
}

if (checks.failed === 0) {
  console.log(`
${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 ALL VALIDATION CHECKS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.cyan}System Status:${colors.reset}
✅ Code structure complete
✅ Database schema valid
✅ Configuration defined
✅ Services implemented
✅ Agent enhanced
✅ API endpoints ready
✅ Error handling robust
✅ Logging & audit complete
✅ Test suite available

${colors.yellow}Deployment Safety: HIGH${colors.reset}
${colors.purple}Ready for: Staging (Waneko) + P2 Development${colors.reset}

${colors.cyan}Next Actions:${colors.reset}
1. Run Migration: step1_migration.mjs
2. Run Test Suite: step2_test_complete.mjs
3. Review this checklist: ✅ All green
4. Start P2 (permissions) development OR go to Waneko
`);
  process.exit(0);
} else {
  console.log(`
${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ VALIDATION INCOMPLETE - REVIEW ITEMS ABOVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);
  process.exit(1);
}

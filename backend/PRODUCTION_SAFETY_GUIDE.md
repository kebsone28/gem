# 🚀 PRODUCTION SAFETY & RECOVERY GUIDE

## ⚠️ CRITICAL: Emergency Recovery Procedures

---

## 1. NORMAL OPERATION (No Issues)

### Monitoring Dashboard
```bash
# Check approval queue
curl http://localhost:3000/api/approvals/pending -H "Authorization: Bearer $TOKEN"

# Response: List of pending approvals waiting for admin
```

### Signs of Healthy System
```
✅ Approval creation latency < 500ms
✅ Approval decisions < 1000ms
✅ Error rate < 0.1%
✅ No SYSTEM_ERROR in logs
✅ No timeout warnings
```

---

## 2. DEGRADED OPERATION (Warning Signs)

### Warning Indicators
```
⚠️ Approval latency > 1s
⚠️ Error rate between 0.1% - 1%
⚠️ Occasional SYSTEM_ERROR responses
⚠️ Database connection warnings in logs
```

### Action: Increase Monitoring
```bash
# Watch logs for errors
tail -f /var/log/app/error.log | grep SYSTEM_ERROR

# Check database connection
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

# Check Redis (if used for cache)
redis-cli ping  # Should return PONG
```

### No Action Needed Yet
- System is self-healing
- Continue normal monitoring
- Watch for sustained degradation

---

## 3. CRITICAL OPERATION (HIGH ALERT)

### Critical Indicators
```
🚨 Approval latency > 5s
🚨 Error rate > 1%
🚨 Multiple SYSTEM_ERROR in logs
🚨 Database connection attempts failing
🚨 Admin getting errors on approval endpoints
```

### Immediate Actions

#### Step 1: Verify Infrastructure
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"
# Should return: 1

# Check Redis (if used)
redis-cli ping
# Should return: PONG

# Check disk space
df -h / | tail -1
# Should have > 10% free
```

#### Step 2: Check Application Health
```bash
# Get current health status
curl http://localhost:3000/health

# Response should show:
# {
#   "status": "UP" or "PARTIAL",
#   "services": {
#     "database": "UP" or "DOWN",
#     "redis": "UP" or "DOWN"
#   }
# }
```

#### Step 3: Review Recent Logs
```bash
# Get last 100 SYSTEM_ERROR entries
grep SYSTEM_ERROR /var/log/app/error.log | tail -100

# Get approval failures
grep "Failed to execute action" /var/log/app/error.log | tail -50
```

---

## 🚨 4. SYSTEM FAILURE - ACTIVATION OF ESCAPE HATCH

### When to Activate Bypass

**ONLY if:**
1. ✅ Database is definitely down (verified above)
2. ✅ Admin needs to execute actions immediately
3. ✅ You've notified the team

**NOT if:**
- It's just slow (network issue)
- Redis is down (but DB is OK)
- A single endpoint is failing

### How to Activate Emergency Bypass

```bash
# SET in production
export APPROVAL_SYSTEM_BYPASS=true

# Or in .env
echo "APPROVAL_SYSTEM_BYPASS=true" >> .env

# Restart application
systemctl restart app  # or your restart command

# Verify bypass is active
curl http://localhost:3000/api/approvals/execute \
  -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -d '{"agentName":"TechAgent","actionType":"getHouseholds","payload":{}}'

# Response should contain: "emergencyMode": true
```

### What Happens in Bypass Mode

```
Normal Mode:
  User Request → Approval Queue → Admin Approval → Execution

Bypass Mode:
  User Request → Direct Execution (NO APPROVAL)
  ⚠️ WARNING: All actions execute immediately
  ⚠️ WARNING: HIGH RISK actions bypass validation
  ⚠️ WARNING: Logged for audit but not blocked
```

### During Bypass Mode - CRITICAL

```
🚨 EVERY REQUEST IS LOGGED WITH:
  - timestamp
  - user
  - action
  - payload
  - "emergencyMode": true

⚠️ ADMIN MUST REVIEW ALL LOGS AFTER RECOVERY

Commands:
# See all bypass executions
grep -i "emergencyMode" /var/log/app/error.log

# Count bypass actions
grep -i "EXECUTED_BYPASS" /var/log/app/error.log | wc -l

# Audit trail by user
grep -i "EXECUTED_BYPASS" /var/log/app/error.log | awk '{print $NF}' | sort | uniq -c
```

---

## 5. RECOVERY PROCEDURE (After Database Restored)

### Step 1: Disable Bypass
```bash
# Unset the environment variable
unset APPROVAL_SYSTEM_BYPASS

# Or remove from .env
sed -i '/APPROVAL_SYSTEM_BYPASS/d' .env

# Restart application
systemctl restart app
```

### Step 2: Verify System Recovery
```bash
# Check health
curl http://localhost:3000/health
# Should show: "status": "UP"

# Try normal approval flow
curl http://localhost:3000/api/approvals/execute \
  -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -d '{
    "agentName":"TechAgent",
    "actionType":"getHouseholds",
    "payload":{"region":"Dakar"},
    "confidence": 0.85
  }'

# Response should have:
# "status": "AUTO_EXECUTED" (not emergencyMode)
```

### Step 3: Audit Bypass Actions (MANDATORY)
```bash
# Get all bypass actions during incident
grep "emergencyMode" /var/log/app/error.log > /tmp/bypass_audit.log

# For each action, verify:
echo "Actions executed during bypass:"
cat /tmp/bypass_audit.log | jq '.userId, .actionType, .payload' 

# Decide: Are these actions OK? Any suspicious?
# If suspicious → DELETE from database + notify admin
```

### Step 4: Resume Normal Operations
```bash
# Clear any pending approvals from bypass
DELETE FROM "ActionApproval" 
WHERE metadata->>'emergencyMode' = 'true' 
AND status != 'EXECUTED';

# Monitor closely
tail -f /var/log/app/app.log | grep -i approval

# All should show:
# "status": "PENDING" or "AUTO_EXECUTED" (not EXECUTED_BYPASS)
```

---

## 6. STRESS TEST VALIDATION

### Before Any Production Deployment

```bash
cd backend
node stress_test_plan.mjs
```

### Expected Output
```
✓ Scenario 1: Normal Approval Flow (Happy Path)
✓ Scenario 2: Approval Rejection (HIGH RISK)
✓ Scenario 3: Concurrent Approvals (Race Condition)
✓ Scenario 4: Idempotency - Double Approve
✓ Scenario 5: Security - Permission Enforcement
✓ Scenario 6: Partial Failure - Tool Error Recovery
✓ Scenario 7: State Consistency (Data Integrity)
✓ Scenario 8: Audit Trail & Logging
✓ Scenario 9: Database Connection Resilience
✓ Scenario 10: Payload Size & Limits

🟢 ALL STRESS TESTS PASSED
Ready for P2

Deployment Safety: HIGH
```

### If Any Test Fails
```
❌ DO NOT DEPLOY TO PRODUCTION

1. Check which test failed
2. Review logs
3. Fix the issue
4. Run stress test again
5. Only deploy when ALL pass
```

---

## 7. MONITORING CHECKLIST

### Daily Health Check
```bash
# 1. Database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"ActionApproval\";"

# 2. Recent errors
grep -i "error\|fail\|critical" /var/log/app/error.log | tail -20

# 3. Approval stats
curl http://localhost:3000/api/approvals/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. System health
curl http://localhost:3000/health | jq .services
```

### Weekly Deep Dive
```bash
# 1. Approval rate
SELECT status, COUNT(*) FROM "ActionApproval" 
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY status;

# 2. Average latency
SELECT 
  AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as max_seconds
FROM "ActionApproval"
WHERE "createdAt" > NOW() - INTERVAL '7 days';

# 3. Rejection analysis
SELECT "actionType", COUNT(*) 
FROM "ActionApproval" 
WHERE status = 'REJECTED' 
AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "actionType";
```

---

## 8. INCIDENT RESPONSE FLOWCHART

```
User reports: "Approval system not working"
                      |
                      v
        Is database up? (test connection)
        /                           \
       YES                          NO
       |                             |
       v                             v
Success rate > 99%?        Restore database
    /        \              from backup
   YES       NO             |
   |          |             v
   |          v             Verify DB restored
   |    Check logs
   |    (SYSTEM_ERROR?)     Run stress_test
   |          |             |
   |    YES---+---NO        v
   |    |        | Enable APPROVAL_SYSTEM_BYPASS
   |    |        |       |
   |    |        v       v
   |    |   Check Redis  Log bypass activations
   |    |        |       |
   |    |     DOWN?      Notify admin
   |    |    /    \      |
   |    |   Y      N     Disable bypass
   |    |   |      |     when recovered
   |    |   v      v     |
   |    |  Restart System still Review logs
   |    |   Redis   broken? for violations
   |    |    |      |     |
   |    +----+      v     v
   |         Check Disable Audit:
   |         logs  bypass - Suspicious
   |               actions?
   v               |
All OK            YES? Flag
                   for review
                   
                   Resume normal ops
```

---

## 9. CONTACT & ESCALATION

### On-Call Contacts
```
Level 1: Database Admin
  Phone: +221-XXX-XXXX
  Slack: @db-admin
  Response time: < 15 min

Level 2: Backend CTO
  Phone: +221-XXX-XXXX
  Slack: @cto-backend
  Response time: < 30 min

Level 3: CEO
  Phone: +221-XXX-XXXX
  Response time: < 60 min
```

### When to Escalate
```
🟢 OK (No Escalation)
  - Approval latency slightly elevated
  - Single user reporting issue
  - Error rate < 1%

🟡 ESCALATE TO LEVEL 1
  - Database connection errors
  - Error rate 1-5%
  - Multiple users affected

🔴 ESCALATE TO LEVEL 2
  - Database down 5+ minutes
  - Error rate > 5%
  - Approval system completely down
  - Need to activate BYPASS

🚨 ESCALATE TO LEVEL 3
  - System down > 30 minutes
  - Data corruption suspected
  - Security breach suspected
```

---

## 10. POST-INCIDENT REVIEW

After any production incident:

```bash
# 1. Collect logs
tar czf /backup/incident-$(date +%s).tar.gz /var/log/app/

# 2. Document timeline
cat > /tmp/incident_report.md << EOF
INCIDENT REPORT
Date: $(date)
Duration: _____ minutes
Root Cause: _____
Impact: _____ users affected
Recovery Time: _____ minutes

Timeline:
- 14:30: Issue detected
- 14:35: Team notified  
- 14:45: Database checked
- 15:00: Recovery completed

Action Items:
- ...
- ...
EOF

# 3. Review all actions
grep "emergencyMode\|BYPASS\|SYSTEM_ERROR" /var/log/app/error.log | \
  jq '.' > /tmp/incident_details.json

# 4. Hold post-mortem (24h)
# Review: What went wrong, why, and how to prevent
```

---

## ✅ SUMMARY

### Normal: Monitor & Enjoy ✅
### Warning: Increase Monitoring ⚠️
### Critical: Check Infrastructure 🚨
### Failure: Activate Bypass 🆘
### Recovery: Verify & Audit ✔️

---

*Last Updated: April 15, 2026*
*Version: 1.0 - Production Ready*

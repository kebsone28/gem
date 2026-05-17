# 📋 COMMANDES PRÊTES À COPIER — 24 mai 2026

**Format**: Copier-coller direct dans terminal PowerShell  
**Prerequis**: `cd C:\Mes-Sites-Web\GEM_SAAS`  
**Timeline**: Exécuter dans cet ordre, ~30 minutes total

---

## ✅ Step 1 — Prisma Generate (1 min)

```powershell
cd backend
npx prisma generate
```

**Expected Output**:
```
✓ Generated Prisma Client (X.XX.X) to .\node_modules\.prisma\client in XsXXms
```

If error: Delete node_modules and retry:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
npx prisma generate
```

---

## ✅ Step 2 — Prisma Migration (5 min)

```powershell
npx prisma migrate dev --name add_domain_config
```

**Expected Output**:
```
✓ Your database is now in sync with your schema. ...
✓ Generated Prisma Client ...
```

If error - Check database:
```powershell
# Verify DATABASE_URL
echo $env:DATABASE_URL

# Try reset (CAREFUL - deletes data)
npx prisma migrate reset --force --skip-generate
```

---

## ✅ Step 3 — Verify Migration

```powershell
# Check schema updated
Select-String -Path "prisma\schema.prisma" -Pattern "DomainConfig" | Select-Object -First 5

# Or view in studio
npx prisma studio
# Then: Check DomainConfig table exists
```

---

## ✅ Step 4 — Update Express App

**Edit**: `backend\src\app.ts` or `backend\src\server.js`

**Find**: Auth middleware line
**Add After**:
```typescript
import { domainContext } from './middleware/domainContext';

app.use(authMiddleware);
app.use(domainContext);  // ← ADD THIS LINE
```

**Verify**:
```powershell
Select-String -Path "backend\src\app.ts" -Pattern "domainContext"
```

---

## ✅ Step 5 — Run Tests

```powershell
# TypeScript lint
npm run lint

# Unit tests
npm run test:adapters

# All tests
npm run test
```

**Expected**: ✅ All passing

---

## ✅ Step 6 — Test Endpoints

**Start backend** (in another terminal):
```powershell
npm run dev
```

**Test household endpoint** (5 min after server starts):
```powershell
# With query parameter
curl.exe -X GET "http://localhost:3000/api/households?domainType=electricity" `
  -H "Authorization: Bearer YOUR_TOKEN"

# With header
curl.exe -X GET "http://localhost:3000/api/households" `
  -H "X-Domain-Type: electricity" `
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: Same response as before (status 200, household data)

---

## ✅ Step 7 — Deploy Staging

```powershell
# Commit changes
git add .
git commit -m "Sprint 1 Foundation: Add DomainAdapter pattern"
git push origin main

# Trigger deployment (if using CI/CD)
# OR manually deploy to staging server
```

---

## 🆘 Troubleshooting — Copy-Paste Solutions

### "Prisma generation failed"
```powershell
cd backend
Remove-Item -Recurse -Force node_modules\.prisma
npx prisma generate
```

### "Migration failed - constraint error"
```powershell
# Check current state
npx prisma migrate status

# Rollback if needed
npx prisma migrate resolve --rolled-back add_domain_config
```

### "Node modules not found"
```powershell
npm install
npx prisma generate
```

### "Tests failing after migration"
```powershell
# Regenerate types
npx prisma generate

# Clear cache
Remove-Item -Recurse -Force node_modules\.next
Remove-Item -Recurse -Force .next

# Retry tests
npm run test
```

### "Middleware not injected"
```powershell
# Verify import
Select-String -Path "backend\src\app.ts" -Pattern "domainContext"

# Verify middleware applied
Select-String -Path "backend\src\app.ts" -Pattern "app.use.*domainContext"
```

### "Household endpoint returns 500"
```powershell
# Check error logs
Get-Content logs\error.log | Select-Object -Last 20

# Check middleware loaded
curl.exe "http://localhost:3000/api/households" `
  -H "Authorization: Bearer TEST" `
  -v

# Look for X-Domain-Type in response headers
```

---

## ✅ Post-Deployment Smoke Tests (Staging)

Run these 30 min after staging deployment:

```powershell
# Test 1: GET households
curl.exe "http://staging-api/api/households" `
  -H "Authorization: Bearer $TOKEN"

# Test 2: GET with domain param
curl.exe "http://staging-api/api/households?domainType=electricity" `
  -H "Authorization: Bearer $TOKEN"

# Test 3: POST household
curl.exe -X POST "http://staging-api/api/households" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d '{"name":"Test","location":{"lat":14.7,"lng":-17.5}}'

# Test 4: Dashboard loads
# Open browser: http://staging-ui/#/terrain
# Verify: Map loads, households visible
```

---

## 📊 Quick Timeline

```
9:00  - Start: cd backend
9:01  - npx prisma generate
9:06  - npx prisma migrate dev --name add_domain_config
9:12  - Verify migration
9:15  - Edit app.ts + add domainContext
9:25  - npm run test
9:35  - Test endpoints (curl)
9:45  - Deploy staging
14:15 - Smoke tests
```

---

## ✨ If Everything Passes ✅

Congrats! Sprint 1 integration complete.

**Next**:
- Share update with team
- Plan agriculture domain (Week 3)
- Start AgricultureAdapter design

**Command to update team**:
```powershell
# Create deployment note
@"
Sprint 1 Foundation: SUCCESSFULLY DEPLOYED

✅ Prisma migration: Success
✅ Middleware integrated: Success
✅ Tests: All passing
✅ Staging: Deployed
✅ Zero regressions: Confirmed

Next phase: Agriculture Implementation (31 mai)
"@ | Out-File -Encoding UTF8 deployment-note-24mai.txt

# Share with team
# Email or Slack the note
```

---

## ❌ If Something Breaks ❌

**Immediate action**:

1. **Identify error**:
   ```powershell
   # Show last 50 lines of error log
   Get-Content backend/logs/error.log -Tail 50
   ```

2. **Rollback if needed**:
   ```powershell
   # Undo middleware
   # (Revert domainContext from app.ts)
   
   # Rollback migration
   cd backend
   npx prisma migrate resolve --rolled-back add_domain_config
   ```

3. **Check prerequisites**:
   ```powershell
   # Database running?
   psql --version
   
   # Environment vars?
   echo $env:DATABASE_URL
   
   # Node modules?
   npm list prisma
   ```

4. **Escalate if needed**:
   - Post in Slack #development
   - Include full error message
   - Reference: PROCHAINES_ETAPES.md + TROUBLESHOOTING section

---

## 📞 Contacts

| Issue | Contact | Channel |
|-------|---------|---------|
| Prisma error | Tech Lead | Slack #dev |
| Database issue | DevOps | Email |
| Migration rollback | Architecture | Slack #critical |
| Questions | Team Lead | Slack #ged-os |

---

*GED OS Sprint 1 — Ready for Execution (24 mai 2026)*

**Print this**: Keep handy during deployment  
**Share**: Send link to team Friday 21 mai  
**Backup**: Save in confluence or wiki

🚀 **Ready? Let's go!**

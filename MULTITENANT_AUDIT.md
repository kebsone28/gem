# Multi-Tenant Architecture Audit — GEM SAAS

**Date:** May 12, 2026  
**Status:** Implementation Phase 4 - Tenant Scoping Enforcement  
**Scope:** PostgreSQL database, Node.js backend, React frontend

---

## 1. Tenant Architecture Overview

### Isolation Model
- **Multi-tenant logical isolation** with single PostgreSQL database
- **Organization-based scoping** — each user belongs to one organization
- **Automatic Prisma client extension** enforces organizationId filter on all queries
- **AsyncLocalStorage context** carries organizationId + projectId through request chain

### Tenant Resolution Flow

```
1. JWT Token (contains organizationId)
   ↓
2. authProtect middleware (sets context via AsyncLocalStorage)
   ↓
3. tenantResolver middleware (validates headers match context)
   ↓
4. Prisma client extension (auto-injects organizationId into queries)
   ↓
5. Database (returns only org-scoped data)
```

---

## 2. Organization Model

### Database Schema
```sql
CREATE TABLE "Organization" (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,    -- e.g., "proquelec-admin"
  name TEXT NOT NULL,           -- e.g., "PROQUELEC"
  config JSONB,
  createdAt TIMESTAMP,
  ...relations to 28+ tables
);
```

### Current Organizations
| ID | Name | Slug | Status |
|----|------|------|--------|
| proquelec-proquele | PROQUELEC | proquelec-proquele | Primary |
| c0b18361-... | PROQUELEC | proquelec-c0b18361 | Secondary |

**Action Required:** Consolidate duplicate PROQUELEC organizations (see recommendations below).

---

## 3. Project Template System

### Templates in Database
Created: May 12, 2026

| Key | Name | Category | Status |
|-----|------|----------|--------|
| supervision-senelec | Supervision Senelec | supervision | Active |
| kobo-formation | Kobo Formation | data-collection | Active |
| audit-technique | Audit Technique | audit | Active |
| erp-chantier | ERP Chantier | project-management | Active |

### Template Tracking in Projects
- **Field Added:** `Project.templateKey` (foreign key to `ProjectTemplate.key`)
- **Field Added:** `Project.templateVersion` (tracks template version used)
- **Endpoint:** `GET /api/projects/:id/template` returns associated template config

### Real Projects
| Name | Template | Organization | Status |
|------|----------|---------------|--------|
| Supervision Senelec | supervision-senelec | PROQUELEC | Active |
| Kobo Global | (none) | PROQUELEC | Auto-created |

---

## 4. Scoped Prisma Architecture

### Location
File: `backend/src/core/utils/prisma.js` (lines 56-98)

### Auto-Filtering Rules

**EXCLUDED_MODELS** (no auto-filtering applied):
```
Organization
SystemLog
AuditLog
Role
Permission
RolePermission
Region
MissionApprovalWorkflow
MissionApprovalStep
UserMemory
FormationSessionModule
FormationParticipant
spatial_ref_sys
```

**ORG_LEVEL_MODELS** (filtered by organizationId):
```
User
Project
Grappe
Mission
Team
Household
Grappes
Missions
TeamMembers
Documents
InternalKoboSubmissions
KoboFormMappings
ChatConversations
FormationModules
FormationSessions
PerformanceLogs
SyncLogs
ConflictLogs
AuditLogs
```

**PROJECT_LEVEL_MODELS** (filtered by projectId if present):
```
Zone
Team
Mission
PerformanceLog
Alert
```

### Implementation Details

#### Read Operations
```javascript
// All reads auto-filter by organizationId
// findUnique is downgraded to findFirst to enforce filtering
prisma.user.findUnique({ where: { id: userId } })
// Executes as:
prisma.user.findFirst({ where: { id: userId, organizationId } })
```

#### Create Operations
```javascript
// organizationId auto-injected into create/createMany
prisma.mission.create({ data: { title: "..." } })
// Becomes:
prisma.mission.create({ data: { title: "...", organizationId } })
```

#### Update/Delete Operations
```javascript
// Single mutations rely on controller-level validation
// Query controller must: findFirst(id, organizationId) before update
const existing = await prisma.mission.findFirst({
  where: { id: missionId, organizationId }
});
if (!existing) throw Error("Not found");
await prisma.mission.update({ where: { id: missionId }, data: {...} });
```

---

## 5. Permission & Authorization Model

### Current Implementation
File: `backend/src/middleware/verifierPermission.js`

#### Granular Permissions
```javascript
// Check specific permission on user.permissions array
verifierPermission('project.view')
verifierPermission('project.edit')
verifierPermission('mission.create')
```

#### Role-Based Fallback
```javascript
// If granular permission not found, check ROLE_PERMISSIONS config
ROLE_PERMISSIONS = {
  ADMIN_PROQUELEC: ['*'],           // All permissions
  ADMIN: ['*'],
  DIRECTEUR: ['project.*', 'mission.*'],
  CHEF_PROJET: ['mission.*', 'team.*'],
  // ...
}
```

#### Special Middleware
- **verifierOrganisation()** — validates `x-organization-id` header matches `req.user.organizationId`
- **verifierAssignation()** — checks if user is assigned to team (team leaders only)
- **verifierProjet()** — validates project exists and user is assigned

---

## 6. Security Vulnerabilities (FIXED)

### ✅ Phase 1: Fixed

#### Kobo Webhook Fallback Vulnerability
**Status:** FIXED (May 12, 2026)

**Before:**
```javascript
const organizationId = req.query.organizationId || req.headers['x-organization-id'];
if (!organizationId) {
  logger.warn("No organizationId, using first org");
  const org = await prisma.organization.findFirst();  // ❌ VULNERABLE
}
```

**After:**
```javascript
const organizationId = req.query.organizationId || req.headers['x-organization-id'];
if (!organizationId) {
  return res.status(400).json({ error: 'organizationId required' });
}
```

**Impact:** Prevents cross-tenant data injection via webhook exploitation.

### ⚠️ Phase 4: Identified Issues

#### Household Query Optional Scoping
**File:** `backend/src/modules/household/household.controller.js` (lines 76-78)

**Issue:**
```javascript
const activeProjectId = req.projectId || projectId;
if (activeProjectId) {  // ⚠️ NOT enforced
  where.projectId = activeProjectId;
}
```

**Risk:** If projectId missing from context, returns households from all projects in org.  
**Recommendation:** Make projectId required for household queries, or enforce at Prisma level.

#### Organization.slug Now Required
**Status:** DONE

Changed from `slug String?` to `slug String` (non-nullable).  
Existing orgs given auto-generated slugs (proquelec-proquele, proquelec-c0b18361).

---

## 7. Data Isolation Test Cases

### Test Harness Location
File: `backend/src/modules/mission/__tests__/approval.security.test.js`

### Existing Tests
- [x] User can only create missions in assigned organization
- [x] User cannot list missions from other organizations
- [x] Admin can view all organization data (within scope)

### Additional Tests Needed
- [ ] Household query isolation (test projectId enforcement)
- [ ] Offline/Dexie sync includes organizationId + projectId
- [ ] WebSocket messages filtered by organizationId
- [ ] Kobo webhook blocks unauthorized organizationId values

---

## 8. Context Management

### AsyncLocalStorage Context
File: `backend/src/core/context/storage.js`

```javascript
export const getOrganizationId = () => getContext().organizationId;
export const getProjectId = () => getContext().projectId;
export const getUserId = () => getContext().userId;

export const runWithContext = (context, callback) => {
  return contextStorage.run(context, callback);
};
```

### Context Injection Points
1. **authProtect middleware** — wraps entire request in context
2. **tenantResolver** — re-establishes context for public routes
3. **Prisma client extension** — reads context for auto-filtering

### Potential Issues
- ⚠️ Async operations outside middleware chain may lose context
- ⚠️ Background jobs need explicit context injection
- ⚠️ WebSocket handlers need context setup

---

## 9. Frontend Isolation (IndexedDB/Dexie)

### Dexie Database Schema
File: `frontend/src/store/db.ts`

```typescript
export const db = new Dexie('gem-db-v15') as Dexie & {
  projects: Table<Project>;
  households: Table<Household>;
  // ...
};
```

### Isolation Requirement
**All offline data must include:**
```typescript
organizationId: string;
projectId?: string;
```

### Risk
If Dexie stores data without organizationId, users can access other org data offline.

---

## 10. WebSocket & Real-Time Isolation

### Chat Service (Uses WebSockets)
File: `backend/src/modules/chat/chat.routes.js`

**Scoping Model:**
```javascript
// ChatConversation has organizationId + scopeKey
const conversation = await prisma.chatConversation.findFirst({
  where: {
    organizationId,
    scopeKey: `team-${teamId}`
  }
});
```

**Current Implementation:** ✅ Properly scoped  
**Status:** No changes needed.

---

## 11. Recommendations

### Immediate (Phase 4)

#### 1. Consolidate Duplicate Organizations
**Current State:** 2 PROQUELEC orgs with different IDs

**Solution:**
```bash
# Identify
SELECT id, name, slug, COUNT(*) FROM "Organization" 
GROUP BY name HAVING COUNT(*) > 1;

# Migrate secondary to primary
UPDATE "User" SET organizationId = 'primary-id' 
WHERE organizationId = 'secondary-id';

UPDATE "Project" SET organizationId = 'primary-id' 
WHERE organizationId = 'secondary-id';

# Delete secondary
DELETE FROM "Organization" WHERE id = 'secondary-id';
```

#### 2. Enforce Household projectId Scoping
**File to Modify:** `backend/src/modules/household/household.controller.js`

**Change:**
```javascript
// BEFORE
if (activeProjectId) where.projectId = activeProjectId;

// AFTER
where.projectId = activeProjectId || null;  // Enforce or fail
```

#### 3. Add Offline Isolation Tests
**Test:** Verify Dexie includes organizationId in all persisted data.

#### 4. Audit Background Jobs
**Files to Review:**
- `backend/src/services/alertEscalationAgent.js`
- `backend/src/services/kobo.service.js`
- Any scheduled tasks

**Requirement:** All jobs must explicitly set context before database operations.

### Medium-term (Phase 5)

#### 1. Implement Atomic Permissions
Replace role-based fallback with granular permission requirements:
```javascript
// Instead of ROLE_PERMISSIONS fallback
[
  'project.view',
  'project.edit', 
  'mission.create',
  'mission.delete',
  'household.edit'
]
```

#### 2. Frontend Module Registry
Replace inline module checks:
```javascript
// BEFORE
if (module === "supervision") { ... }

// AFTER
const MODULE_REGISTRY = {
  supervision: SupervisionModule,
  missions: MissionsModule
};
const Component = MODULE_REGISTRY[module];
```

#### 3. Comprehensive Audit Logging
Log all cross-boundary queries (org, project level):
```javascript
if (queryOrgId !== contextOrgId) {
  await auditLog('CROSS_ORG_ACCESS_BLOCKED', {
    userId,
    contextOrgId,
    queryOrgId,
    reason: 'Tenant isolation violation'
  });
}
```

---

## 12. Checklist for Production

- [ ] All organizations have unique, non-null slugs
- [ ] No duplicate organizations (consolidate if found)
- [ ] Kobo webhook requires explicit organizationId
- [ ] Household queries enforce projectId filtering
- [ ] All Dexie offline data includes organizationId
- [ ] WebSocket messages filtered by organizationId
- [ ] Background jobs run with explicit context
- [ ] Audit logging captures cross-boundary attempts
- [ ] Unit tests pass for tenant isolation
- [ ] Security review of Prisma extension coverage
- [ ] Frontend permissions module implemented
- [ ] Documentation deployed to team

---

## 13. Architecture Summary

| Layer | Isolation Method | Status |
|-------|------------------|--------|
| Database | Prisma extension auto-filtering | ✅ Implemented |
| API Routes | middleware (verifierOrganisation, verifierProjet) | ✅ Implemented |
| Context | AsyncLocalStorage (request-scoped) | ✅ Implemented |
| Permissions | Granular + role-based fallback | ✅ Implemented |
| Offline | Dexie (IndexedDB) | ⚠️ Needs verification |
| WebSocket | ChatConversation organizationId + scopeKey | ✅ Implemented |
| Background Jobs | Manual context injection | ⚠️ Needs audit |

---

## 14. Next Steps

1. **Immediately:** Fix Kobo webhook (DONE), make Organization.slug required (DONE)
2. **This week:** Consolidate orgs, enforce Household scoping, audit background jobs
3. **Next week:** Implement atomic permissions, frontend module registry
4. **Before release:** Security review, comprehensive testing

---

*Document generated: May 12, 2026*  
*Last updated: May 12, 2026*

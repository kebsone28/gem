# 🚀 GEM SAAS — Quick Implementation Checklist

## Phase 1-5 COMPLÉTÉES ✅

### Phase 1: Security Fixes
- [x] Kobo webhook vulnerability fixed
- [x] Organization.slug made required
- [x] Admin script updated with slug generation

### Phase 2: Template Tracking  
- [x] templateKey + templateVersion added to Project
- [x] GET /api/projects/:id/template endpoint created
- [x] Prisma client tracks template origin

### Phase 3: Template Separation
- [x] ProjectTemplate/ProjectPage/ProjectModule tables created
- [x] 4 default templates seeded to database
- [x] Supervision Senelec created as real DB project
- [x] Frontend template API integration ready

### Phase 4: Tenant Scoping
- [x] consolidate_orgs.mjs script ready
- [x] Household projectId filtering enforced
- [x] Dexie offline schema verified (organizationId included)
- [x] jobContext.js helper created
- [x] Alert escalation agent updated with context

### Phase 5: Architecture Finalized
- [x] atomicPermissions.js (40+ permissions, 6+ roles)
- [x] MODULE_REGISTRY.ts (12 modules, lazy loading)
- [x] multitenant-isolation.security.test.js (20+ tests)

---

## NEXT STEPS — Deployment Phase

### Immediate (Today)
- [ ] **Read** DEPLOYMENT_PLAN.md (this document)
- [ ] **Read** MULTITENANT_AUDIT.md (architecture)
- [ ] **Backup** production database NOW

### Day 1-2: Database Operations
```bash
# 1. Backup
pg_dump electrification > backup_$(date +%Y%m%d).sql

# 2. Consolidate duplicate orgs
node backend/scripts/consolidate_orgs.mjs

# 3. Run migrations
cd backend && npx prisma migrate deploy

# 4. Seed templates & data
node backend/scripts/seed_templates.mjs
node backend/scripts/create_senelec_project.mjs
```

**Checklist:**
- [ ] Backup created and verified
- [ ] consolidate_orgs.mjs executed successfully
- [ ] Migrations applied without errors
- [ ] All 4 templates in database
- [ ] Supervision Senelec project exists

### Day 2-3: Backend Integration
```javascript
// 1. Import atomicPermissions in your auth middleware
import { hasPermission } from '../core/config/atomicPermissions.js';

// 2. Verify jobContext helper works
import { withJobContext } from '../core/utils/jobContext.js';

// 3. Update routes to use atomic permissions
// Replace: verifierPermission(PERMISSIONS.CREER_PROJET)
// With: verifierPermission('project.create')
```

**Files to update:**
- [ ] backend/src/middleware/verifierPermission.js
- [ ] All route files using permissions
- [ ] All background jobs using prisma

### Day 3-4: Frontend Integration
```typescript
// 1. Import MODULE_REGISTRY
import { getSidebarMenuItems, getEnabledModules } from '../modules/MODULE_REGISTRY';

// 2. Replace hardcoded module checks
// Replace: if(module === "dashboard") { ... }
// With: getEnabledModules(enabledKeys).map(...)

// 3. Update Sidebar to use getSidebarMenuItems()
// Update: Main routing with filterModulesByPermission()
```

**Files to update:**
- [ ] Sidebar component (use getSidebarMenuItems)
- [ ] Main router (use MODULE_REGISTRY)
- [ ] ProjectContext (use getEnabledModules)

### Day 4-5: Testing
```bash
# Run security tests
npm test -- multitenant-isolation.security.test.js

# Manual testing scenarios (see DEPLOYMENT_PLAN.md)
# 1. Test org isolation
# 2. Test permission enforcement
# 3. Test Kobo webhook
# 4. Test template system
```

**Checklist:**
- [ ] All 20+ security tests passing
- [ ] Manual scenarios validated
- [ ] Cross-tenant access blocked
- [ ] Offline sync working

### Day 5-6: Documentation
- [ ] Create docs/ARCHITECTURE.md
- [ ] Create docs/DEPLOYMENT.md  
- [ ] Create docs/PERMISSIONS.md
- [ ] Train team on new systems

### Day 6-7: Hardening & Go-Live
- [ ] Configure monitoring & alerting
- [ ] Setup audit logging
- [ ] Configure backups
- [ ] Security review
- [ ] Deploy to production

---

## ⚡ Quick Reference

### Atomic Permissions (40+)
```javascript
// Location: backend/src/core/config/atomicPermissions.js

// Usage:
import { hasPermission } from '../core/config/atomicPermissions.js';

if (hasPermission(user.permissions, 'project.create', user.role)) {
  // User can create projects
}
```

### Module Registry (12 modules)
```typescript
// Location: frontend/src/modules/MODULE_REGISTRY.ts

// Usage:
import { getSidebarMenuItems, canAccessModule } from '../modules/MODULE_REGISTRY';

const menuItems = getSidebarMenuItems(enabledModules, userPermissions);
const canAccess = canAccessModule('missions', userPermissions);
```

### Job Context
```javascript
// Location: backend/src/core/utils/jobContext.js

// Usage:
import { withJobContext, withBatchContext } from '../core/utils/jobContext.js';

// For single org/project job
await withJobContext({ organizationId, projectId }, async () => {
  const missions = await prisma.mission.findMany();
});

// For batch processing
await withBatchContext(organizations, async (org) => {
  // Each org processed with its own context
});
```

### Consolidation Script
```bash
# Location: backend/scripts/consolidate_orgs.mjs

# Usage:
node consolidate_orgs.mjs

# Output:
# Merges duplicate organizations
# Migrates all related data
# Deletes secondary orgs
```

---

## Common Issues & Fixes

### Issue: "organizationId not found in context"
**Solution:** Add `withJobContext` wrapper to background job
```javascript
// Before
async function checkKPIs(projectId, orgId) { ... }

// After
export const checkKPIsWithContext = async (projectId, orgId) => {
  return withJobContext({ organizationId: orgId, projectId }, 
    () => checkKPIs(projectId, orgId)
  );
};
```

### Issue: "Module not appearing in sidebar"
**Solution:** Check if:
1. Module is in enabledModules config
2. User has required permission
```typescript
// Debug
console.log('Enabled:', project.config.enabledModules);
console.log('User perms:', user.permissions);
console.log('Accessible:', getSidebarMenuItems(
  project.config.enabledModules,
  user.permissions
));
```

### Issue: "Cross-org access not blocked"
**Solution:** Verify Prisma extension is active:
```javascript
// Check in database logs
// All queries should include WHERE "organizationId" = ?

// Debug
const result = await prisma.project.findMany();
// Should only return user's org projects
```

### Issue: "Offline data not syncing"
**Solution:** Verify Dexie includes organizationId:
```typescript
// In DevTools > Application > IndexedDB
// Check that all records have organizationId field

// If missing, update ProjectContext sync
await db.projects.bulkPut(
  projects.map(p => ({
    ...p,
    organizationId: user.organizationId  // Add this!
  }))
);
```

---

## Testing Checklist

Before going live, verify:

**Security**
- [ ] GET /api/projects returns only user's org projects
- [ ] GET /api/projects/{other-org-project} returns 404
- [ ] POST /api/kobo/webhook without organizationId returns 400
- [ ] User from Org-A cannot access Org-B data
- [ ] Household queries scoped by projectId

**Functionality**
- [ ] All 4 templates load in Admin creation
- [ ] Project creation tracks templateKey
- [ ] Supervision Senelec project works
- [ ] Module sidebar shows correct modules
- [ ] Permissions enforce correctly

**Performance**
- [ ] Queries < 100ms (with scoping)
- [ ] Offline sync works
- [ ] Background jobs complete in time

**Compliance**
- [ ] Audit logs created for all mutations
- [ ] Cross-boundary access logged
- [ ] Backups working
- [ ] Monitoring alerting

---

## Support Resources

📖 **Full Documentation:**
- MULTITENANT_AUDIT.md — Complete architecture
- DEPLOYMENT_PLAN.md — Detailed deployment steps
- atomicPermissions.js — Permission definitions
- MODULE_REGISTRY.ts — Module definitions

🧪 **Tests:**
- multitenant-isolation.security.test.js — Security tests

🔧 **Scripts:**
- consolidate_orgs.mjs — Org consolidation
- seed_templates.mjs — Template seeding
- create_senelec_project.mjs — Project creation

---

## Timeline

```
Today:        Read plans, backup DB
Day 1:        Consolidation + migrations
Day 2:        Backend integration
Day 3-4:      Frontend integration + testing
Day 5:        Documentation
Day 6-7:      Hardening + go-live
```

**Total effort:** ~32 hours over 7 days

---

## ✅ Success Criteria

You're done when:

✅ No duplicate organizations  
✅ All 4 templates in database  
✅ Supervision Senelec is a real project  
✅ Atomic permissions integrated  
✅ MODULE_REGISTRY used in frontend  
✅ Security tests all passing  
✅ Cross-tenant access blocked  
✅ Documentation complete  
✅ Monitoring configured  
✅ Production backup working  

---

## Next Action

👉 **Execute:** `node backend/scripts/consolidate_orgs.mjs`  
👉 **Then:** `npx prisma migrate deploy`  
👉 **Then:** Follow DEPLOYMENT_PLAN.md day by day

Good luck! 🚀

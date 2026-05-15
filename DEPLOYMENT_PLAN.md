# GEM SAAS — Plan de Finalisation & Déploiement
**Date:** May 12, 2026  
**Status:** Prêt pour phase de déploiement  
**Durée estimée:** 5-7 jours

---

## 1. Étapes Immédiate (Jour 1-2)

### 1.1 Exécuter Script de Consolidation d'Organisations
**Environnement:** Production Database

```bash
# Connectez-vous à votre serveur de prod
cd /path/to/backend

# Backup de la base de données d'abord (IMPORTANT!)
pg_dump electrification > backup_$(date +%Y%m%d).sql

# Exécuter le script
node scripts/consolidate_orgs.mjs

# Vérifier les résultats
psql -d electrification -c "SELECT name, COUNT(*) FROM \"Organization\" GROUP BY name;"
```

**Checklist:**
- [ ] Backup créé
- [ ] Script exécuté sans erreurs
- [ ] Vérifier 0 duplicatas après exécution
- [ ] Vérifier les relations de données (users, projects, missions migrated)

---

### 1.2 Exécuter Migration Prisma
```bash
cd backend
npx prisma migrate deploy

# Ou si migration manuelle
npx prisma db push
```

**Checklist:**
- [ ] Migrations appliquées avec succès
- [ ] Organization.slug requis ✅
- [ ] Project.templateKey + templateVersion ajoutés ✅
- [ ] ProjectTemplate/ProjectPage/ProjectModule tables créées ✅

---

### 1.3 Seeder les Données Initiales
```bash
# Templates
node scripts/seed_templates.mjs

# Supervision Senelec project
node scripts/create_senelec_project.mjs

# Mettre à jour admin local si nécessaire
node scripts/create_admin_local.mjs
```

**Résultat attendu:**
- 4 templates en DB (Supervision, Kobo, Audit, ERP)
- 1 projet real (Supervision Senelec)
- Admin user créé avec slug

---

## 2. Intégration Backend (Jour 2-3)

### 2.1 Déployer Atomic Permissions
**Fichier:** `backend/src/core/config/atomicPermissions.js`

**Étapes:**
1. Vérifier que le fichier existe ✅ (créé)
2. Importer dans vos services d'authentification:

```javascript
// backend/src/middleware/verifierPermission.js
import { hasPermission, getAllPermissions, ATOMIC_PERMISSIONS } from '../core/config/atomicPermissions.js';

// Remplacer la logique existante
export const verifierPermission = (requiredPerm) => {
  return (req, res, next) => {
    const userPerms = req.user.permissions || [];
    const userRole = req.user.role;

    if (hasPermission(userPerms, requiredPerm, userRole)) {
      return next();
    }

    res.status(403).json({
      error: `Missing permission: ${requiredPerm}`,
      required: requiredPerm,
      available: getAllPermissions(userPerms, userRole)
    });
  };
};
```

3. Mettre à jour les routes pour utiliser les permissions atomiques:

```javascript
// Avant
router.post('/', verifierPermission('CREER_PROJET'), createProject);

// Après
import { ATOMIC_PERMISSIONS } from '../core/config/atomicPermissions.js';
router.post('/', verifierPermission(ATOMIC_PERMISSIONS['project.create']), createProject);
```

**Checklist:**
- [ ] atomicPermissions.js importé dans les middlewares
- [ ] Routes mises à jour avec perms atomiques
- [ ] Tests d'autorisation passent
- [ ] Fallback role-based fonctionne

---

### 2.2 Intégrer Job Context Helpers
**Fichier:** `backend/src/core/utils/jobContext.js`

**Étapes:**
1. Les background jobs utilisent déjà le wrapper ✅ (alertEscalationAgent mis à jour)
2. Vérifier les autres jobs:

```bash
# Trouver tous les setInterval/setTimeout
grep -r "setInterval\|setTimeout" backend/src/services/ | grep -v node_modules
```

3. Wrapper les jobs background critiques:

```javascript
// Avant
setInterval(async () => {
  const projects = await prisma.project.findMany();
  // ... process
}, 5 * 60 * 1000);

// Après
import { withBatchContext } from '../core/utils/jobContext.js';

setInterval(async () => {
  const orgs = await prisma.organization.findMany();
  
  await withBatchContext(orgs, async (org) => {
    const projects = await prisma.project.findMany();
    // ... process - now auto-scoped!
  });
}, 5 * 60 * 1000);
```

**Jobs à vérifier:**
- [ ] alertEscalationAgent ✅ (fait)
- [ ] Kobo sync service
- [ ] Formation planner
- [ ] Performance calculator
- [ ] Cache invalidation

---

### 2.3 Tests de Sécurité
**Fichier:** `backend/src/modules/__tests__/multitenant-isolation.security.test.js`

```bash
cd backend

# Exécuter les tests
npm test -- multitenant-isolation.security.test.js

# Ou avec couverture
npm test -- --coverage src/modules/__tests__/multitenant-isolation.security.test.js
```

**Tests à valider:**
- [ ] Organization isolation test
- [ ] Project scoping test
- [ ] Kobo webhook security test
- [ ] Permission checks test
- [ ] Data leakage prevention test
- [ ] Cross-boundary access blocked

---

## 3. Intégration Frontend (Jour 3-4)

### 3.1 Déployer MODULE_REGISTRY
**Fichier:** `frontend/src/modules/MODULE_REGISTRY.ts`

**Usage dans Sidebar:**
```tsx
// Before
import { useSidebar } from '../contexts/SidebarContext';

export const Sidebar = () => {
  const { modules } = useSidebar();
  
  return (
    <div>
      {modules.map(m => (
        <Link key={m.id} to={m.route}>{m.name}</Link>
      ))}
    </div>
  );
};

// After
import { getSidebarMenuItems } from '../modules/MODULE_REGISTRY';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar = () => {
  const { user } = useAuth();
  const { project } = useProject();
  
  const menuItems = getSidebarMenuItems(
    project?.config?.enabledModules || [],
    user?.permissions || []
  );
  
  return (
    <div>
      {menuItems.map(item => (
        <Link key={item.key} to={item.route}>
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </div>
  );
};
```

**Usage dans Routing:**
```tsx
// Before
{activeProject && (
  <>
    {enabledModules.includes('dashboard') && <Dashboard />}
    {enabledModules.includes('missions') && <Missions />}
    {enabledModules.includes('planning') && <Planning />}
    {/* ... */}
  </>
)}

// After
import { getEnabledModules, filterModulesByPermission } from '../modules/MODULE_REGISTRY';

const accessibleModules = filterModulesByPermission(
  getEnabledModules(activeProject?.config?.enabledModules),
  user?.permissions
);

return (
  <Routes>
    {accessibleModules.map(module => (
      <Route
        key={module.key}
        path={module.route}
        element={<Suspense fallback={<Loading />}>
          <module.component />
        </Suspense>}
      />
    ))}
  </Routes>
);
```

**Checklist:**
- [ ] MODULE_REGISTRY importé
- [ ] Sidebar utilise getSidebarMenuItems()
- [ ] Routes dynamiques avec module registry
- [ ] Lazy loading des composants ✅ (déjà implémenté)
- [ ] Fallback pour modules non trouvés

---

### 3.2 Mettre à Jour ProjectContext
```tsx
// frontend/src/contexts/ProjectContext.tsx

import { getEnabledModules } from '../modules/MODULE_REGISTRY';

// Dans le contexte, ajouter:
const enabledModules = getEnabledModules(
  project?.config?.enabledModules || []
);
```

**Checklist:**
- [ ] PROJECT_FEATURES remplacé par MODULE_REGISTRY
- [ ] Perms checking intégré avec MODULE_REGISTRY
- [ ] AdminProjectCreation utilise l'API (déjà fait ✅)

---

### 3.3 Tester Frontend Offline
```bash
cd frontend

# Vérifier que Dexie sync inclut organizationId
npm test -- --grep "offline"

# Test manuel:
# 1. Ouvrir DevTools > Application > IndexedDB
# 2. Vérifier que projects table inclut organizationId
# 3. Vérifier que households table inclut organizationId
```

**Checklist:**
- [ ] Dexie schema includes organizationId ✅
- [ ] Offline sync populated correctement
- [ ] Cross-org data NOT cached locally

---

## 4. Tests Complets (Jour 4-5)

### 4.1 Tests Manuels Scénarios Critiques

**Scénario 1: Isolation Multi-Tenant**
```
1. Créer 2 organisations: Org-A et Org-B
2. Créer des projets dans chaque org
3. User from Org-A tente d'accéder à Org-B:
   - GET /api/projects → doit retourner que projets Org-A
   - GET /api/projects/{orgB-project-id} → 404
   - GET /api/households?search=... → que households Org-A
✓ PASS si accès bloqué
```

**Scénario 2: Permission Enforcement**
```
1. User avec role EMPLOYE (permissions limitées)
2. Tente POST /api/missions/create → 403
3. Tente GET /api/missions → 200 (lecture OK)
4. User avec role CHEF_PROJET:
   - POST /api/missions → 201 (création OK)
   - DELETE /api/missions/{id} → 403 (delete pas permis pour ce rôle)
✓ PASS si perms correctement appliquées
```

**Scénario 3: Kobo Webhook Security**
```
1. POST /api/kobo/webhook (no organizationId) → 400
2. POST /api/kobo/webhook?organizationId=org-a → process
3. POST /api/kobo/webhook?organizationId=org-b (user from org-a) → block
✓ PASS si sécurité webhook appliquée
```

**Scénario 4: Template System**
```
1. GET /api/project-templates → retourne 4 templates
2. GET /api/projects/{id}/template → retourne config du template
3. Créer projet depuis template → templateKey populé
✓ PASS si template tracking fonctionne
```

### 4.2 Tests de Performance
```bash
# Vérifier que auto-filtering Prisma n'impacte pas perfs
npm test -- --grep "performance"

# Benchmark: 1000 missions queries
# Avant optimization: X ms
# Après scoped filtering: X ms (acceptable si < 20% overhead)
```

---

## 5. Documentation & Training (Jour 5-6)

### 5.1 Créer Documentation Développeur
Créer `docs/ARCHITECTURE.md`:
```markdown
# GEM Architecture

## Atomic Permissions
- See: atomicPermissions.js
- 40+ granular permissions
- Role fallback: ROLE_PERMISSION_MAP

## Module System
- See: MODULE_REGISTRY.ts
- 12 modules avec lazy loading
- Permission-based access control

## Multi-Tenant Scoping
- See: MULTITENANT_AUDIT.md
- AsyncLocalStorage context
- Prisma auto-filtering
- Background job context

## Adding New Feature
1. Define atomic permission (e.g., 'feature.create')
2. Create module in MODULE_REGISTRY
3. Require permission in endpoint
4. Add test case to isolation.security.test.js
```

### 5.2 Créer Runbook Déploiement
Créer `docs/DEPLOYMENT.md`:
```markdown
# Deployment Checklist

## Pre-Deployment
- [ ] Database backup
- [ ] Schema migrations tested
- [ ] Tests passing (100% coverage)

## Deployment Steps
1. Run consolidate_orgs.mjs
2. npx prisma migrate deploy
3. npm test -- security
4. Deploy backend
5. Deploy frontend
6. Verify audit logs

## Post-Deployment
- [ ] Monitor error logs
- [ ] Check audit trail for anomalies
- [ ] Verify cross-org access blocked
- [ ] Test offline sync
```

### 5.3 Créer Guide Permission Management
```markdown
# Adding New Permission

1. Add to ATOMIC_PERMISSIONS in atomicPermissions.js:
   'feature.action': 'Description'

2. Add to ROLE_PERMISSION_MAP for applicable roles

3. Use in middleware:
   router.post('/', verifierPermission('feature.action'), controller)

4. Add test case:
   it('should check feature.action permission', ...)
```

---

## 6. Production Hardening (Jour 6-7)

### 6.1 Configuration Sécurité
```javascript
// backend/.env.production
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=long-random-secret-min-32-chars
LOG_LEVEL=warn
ENABLE_AUDIT_LOGGING=true
REQUIRE_2FA_FOR_ADMINS=true
SESSION_TIMEOUT=3600
CORS_ORIGINS=https://yourdomain.com
```

### 6.2 Monitoring & Alerting
Configurer des alertes pour:
- Cross-tenant access attempts (AuditLog.organizationId mismatch)
- Failed permission checks
- Kobo webhook rejections
- Background job errors

```javascript
// Exemple: Setup AlertEscalationAgent monitoring
if (err && err.message.includes('organizationId')) {
  await notifySecurityTeam({
    type: 'SECURITY_ALERT',
    message: 'Cross-tenant access attempt detected',
    details: err
  });
}
```

### 6.3 Backup & Recovery
```bash
# Daily backup
0 2 * * * pg_dump electrification | gzip > backups/$(date +\%Y\%m\%d).sql.gz

# Test restore
pg_restore -d electrification_test backups/20260512.sql.gz
```

---

## 7. Validation Finale

### Checklist Pre-Release

- [ ] **Security**
  - [ ] Cross-tenant access blocked (all endpoints)
  - [ ] Kobo webhook requires organizationId
  - [ ] Household queries scoped by projectId
  - [ ] Background jobs run with context

- [ ] **Architecture**
  - [ ] Atomic permissions implemented (40+ perms)
  - [ ] Module registry deployed (12 modules)
  - [ ] Template system working
  - [ ] Offline sync includes organizationId

- [ ] **Testing**
  - [ ] Unit tests passing (>80% coverage)
  - [ ] Security tests passing (20+ isolation tests)
  - [ ] Manual scenarios validated
  - [ ] Performance acceptable

- [ ] **Documentation**
  - [ ] MULTITENANT_AUDIT.md complete
  - [ ] Developer guide created
  - [ ] Deployment runbook ready
  - [ ] Permission management guide ready

- [ ] **Monitoring**
  - [ ] Audit logging enabled
  - [ ] Security alerts configured
  - [ ] Error tracking setup
  - [ ] Performance monitoring enabled

---

## 8. Go-Live & Support (Day 7+)

### Launch Plan
```
T-1: Final security review
T-0: Deploy to production
T+1h: Monitor for errors
T+4h: Full functionality check
T+24h: Performance analysis
T+7d: Security audit
```

### Support Escalation
```
Critical Issues:
- Cross-tenant data exposure → Page on-call
- Kobo sync broken → Alert team
- Permission system down → Disable new features

Normal Issues:
- Module not showing → Check permissions
- Offline not syncing → Check organizationId in cache
- Performance slow → Check query logs
```

---

## Timeline Résumé

| Jour | Tâche | Duration |
|------|-------|----------|
| **1-2** | Consolidation + migrations + seeding | 4h |
| **2-3** | Intégration backend permissions + jobs | 6h |
| **3-4** | Intégration frontend MODULE_REGISTRY | 6h |
| **4-5** | Tests complets (manuels + auto) | 8h |
| **5-6** | Documentation + training | 4h |
| **6-7** | Hardening + monitoring + backup | 4h |
| **7+** | Go-live + support | Ongoing |

**Total:** ~32h (4 jours développement)

---

## Contact & Support

- **Architect:** Claude Code
- **Architecture Doc:** MULTITENANT_AUDIT.md
- **Test Suite:** multitenant-isolation.security.test.js
- **Emergency:** Use backup + rollback procedure

---

**Status:** ✅ Ready for deployment  
**Next Step:** Execute consolidation script in production

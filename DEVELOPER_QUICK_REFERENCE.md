# GED OS Multidomaine — Quick Reference

**TL;DR pour développeurs**

---

## 🎯 Mission

Transformer GED OS de produit électrification vers **plateforme générique multidomaine**.

- ✅ Garder électrification stable (0 régression)
- ✅ Généraliser le code via adapter pattern
- ✅ Ajouter nouveaux domaines progressivement

---

## 📂 Structure de Fichiers

```
backend/
├── src/
│   ├── domain-adapters/
│   │   ├── DomainAdapter.ts           (interface abstraite)
│   │   ├── DomainAdapterFactory.ts    (registry)
│   │   ├── ElectrificationAdapter.ts  (GEM existant → adapter)
│   │   ├── AgricultureAdapter.ts      (NEW)
│   │   ├── HealthAdapter.ts           (NEW)
│   │   └── LogisticsAdapter.ts        (NEW)
│   ├── services/domain/
│   │   └── DomainConfigService.ts     (NEW)
│   ├── middleware/
│   │   └── domainContext.js           (NEW - charge config/adapter)
│   ├── routes/
│   │   ├── entities.js                (NEW - generic endpoints)
│   │   └── index.js                   (+ domain-specific routes)
│   └── modules/
│       ├── household/                 (UNCHANGED)
│       ├── field/                     (NEW)
│       ├── healthCenter/              (NEW)
│       └── warehouse/                 (NEW)
├── prisma/
│   ├── schema.prisma                  (+ DomainConfig, Field, HealthCenter, Warehouse)
│   └── migrations/
│       ├── 001_add_domain_config.sql  (NEW)
│       ├── 002_add_field.sql          (NEW)
│       └── ...
└── __tests__/
    ├── adapters/
    │   ├── ElectrificationAdapter.test.js
    │   ├── AgricultureAdapter.test.js
    │   └── ...
    └── api/
        └── entities.test.js

frontend/
├── src/
│   ├── components/terrain/
│   │   └── layers/
│   │       ├── HouseholdLayer.tsx     (RENAME/ADAPT)
│   │       └── EntityLayer.tsx        (NEW - generic)
│   ├── adapters/
│   │   ├── DomainRenderAdapter.ts     (NEW - interface)
│   │   ├── ElectrificationRenderAdapter.ts (NEW)
│   │   ├── AgricultureRenderAdapter.ts    (NEW)
│   │   └── ...
│   └── pages/
│       ├── HouseholdPage.tsx          (GEM legacy)
│       ├── FieldsPage.tsx             (NEW)
│       ├── HealthPage.tsx             (NEW)
│       └── WarehousePage.tsx          (NEW)
└── __tests__/
    └── e2e/
        └── multidomaine.spec.ts       (NEW)
```

---

## 🔑 Key Classes & Interfaces

### Backend

```typescript
// DomainAdapter.ts
interface DomainAdapter {
  domainType: string;
  normalizeEntity(raw: any): Promise<Entity>;
  validateEntity(entity: any): ValidationError[];
  deriveStatus(entity: any): string;
  generateAlerts(entity: any): Alert[];
  getEntityFields(): string[];
  getOptimalQueryShape(): any;
}

// DomainConfigService.ts
class DomainConfigService {
  getConfig(orgId, domainType): Promise<DomainConfig>
  validateEntity(orgId, domainType, entity): Promise<ValidationError[]>
}

// middleware: domainContext.ts
async function domainContext(req, res, next) {
  req.domainType = extractDomainType(req);
  req.domainConfig = await DomainConfigService.getConfig(...);
  req.domainAdapter = DomainAdapterFactory.getAdapter(req.domainType);
  next();
}
```

### Frontend

```typescript
// DomainRenderAdapter.ts
interface DomainRenderAdapter {
  getColorByStatus(props: any): string;
  getIconId(props: any): string;
  toFeature(entity: any): Feature;
  getPopupContent(entity: any): string;
}

// EntityLayer.tsx
<EntityLayer 
  entityType="household|field|healthCenter|warehouse"
  domainType="electricity|agriculture|health|logistics"
  map={map}
/>
```

---

## 📋 Checklist : Ajouter un Nouveau Domaine

### 1. Database (Prisma)
- [ ] Créer migration avec nouvelle table(s)
- [ ] Exemple : `field`, `livestock` pour agriculture
- [ ] Ajouter indices de perf
- [ ] Lancer `prisma migrate deploy`

### 2. Backend Adapter
- [ ] Créer `[Domain]Adapter.ts`
- [ ] Implémenter interface `DomainAdapter`
- [ ] Implémenter `validateEntity()` avec règles métier
- [ ] Implémenter `generateAlerts()`
- [ ] Ajouter tests unitaires (85%+ coverage)
- [ ] Enregistrer dans `DomainAdapterFactory`

### 3. Services
- [ ] Créer `[Entity]Service.ts` pour logique métier
- [ ] Créer contrôleur API
- [ ] Implémenter routes CRUD

### 4. Frontend Adapter
- [ ] Créer `[Domain]RenderAdapter.ts`
- [ ] Implémenter interface `DomainRenderAdapter`
- [ ] Adapter `getColorByStatus()` pour domaine
- [ ] Adapter `toFeature()` pour géométrie

### 5. Pages
- [ ] Créer `[Domain]Page.tsx`
- [ ] Utiliser `EntityLayer` générique
- [ ] Ajouter dashboard/stats domaine-spécifiques

### 6. Tests
- [ ] Tests unitaires adapters (85%+)
- [ ] Tests intégration API endpoints
- [ ] Tests E2E user journey (login → select domain → see data)

### 7. Documentation
- [ ] Ajouter domaine à `GED_OS_DEFINITION.md`
- [ ] Documenter spécifications métier
- [ ] API docs

---

## 🚀 Quick Start : Développeur

### Setup Local

```bash
# Clone
git clone https://github.com/your-org/GED_SAAS.git
cd GED_SAAS

# Install
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Database
cd backend
npx prisma migrate deploy
npx prisma db seed

# Dev servers
npm run dev:saas
# → Backend: http://localhost:3000
# → Frontend: http://localhost:5174
```

### Développer Nouveau Domaine

```bash
# 1. Create adapter
cat > backend/src/domain-adapters/MyDomainAdapter.ts << 'EOF'
export class MyDomainAdapter implements DomainAdapter {
  domainType = "mydomain";
  // ... implement interface
}
EOF

# 2. Register adapter
# Edit backend/src/domain-adapters/DomainAdapterFactory.ts
# Add: this.register(new MyDomainAdapter());

# 3. Create frontend adapter
cat > frontend/src/adapters/MyDomainRenderAdapter.ts << 'EOF'
export class MyDomainRenderAdapter implements DomainRenderAdapter {
  // ... implement interface
}
EOF

# 4. Test
cd backend
npm run test:adapters
cd ../frontend
npm run test:unit

# 5. Run E2E
npm run test:e2e
```

---

## 🔗 API Examples

### Get Entities (Generic)

```bash
# Electricity
curl http://localhost:3000/api/entities?domainType=electricity \
  -H "Authorization: Bearer TOKEN"

# Agriculture
curl http://localhost:3000/api/entities?domainType=agriculture \
  -H "Authorization: Bearer TOKEN"

# Custom header (alternative)
curl http://localhost:3000/api/entities \
  -H "X-Domain-Type: health" \
  -H "Authorization: Bearer TOKEN"
```

### Create Entity

```bash
# Household
POST /api/entities
{
  "name": "House 1",
  "latitude": 14.5,
  "longitude": -13.5,
  "domainType": "electricity"
}

# Field
POST /api/entities
{
  "name": "Field A",
  "latitude": 14.5,
  "longitude": -13.5,
  "domainType": "agriculture",
  "crop": "maize",
  "area": 2.5
}
```

---

## 📊 Metrics to Track

| Métrique | Target | Baseline |
|----------|--------|----------|
| **Regression tests pass** | 100% | ⏳ |
| **API response time** | < 500ms | ⏳ |
| **Code coverage** | ≥ 85% | ⏳ |
| **Domains supported** | 6 | 1 (electricity) |
| **Time to add domain** | 2 weeks | ⏳ |

---

## 🐛 Debugging

### Enable Domain Logging

```bash
export DEBUG=ged-os:domain:*
npm run dev:backend
```

### Inspect DomainConfig

```bash
npx prisma studio
# Navigate to DomainConfig table
```

### Test Adapter Directly

```bash
# backend/src/domain-adapters/test-adapter.js
const adapter = new AgricultureAdapter();
const normalized = await adapter.normalizeEntity({
  name: "Field 1",
  crop: "maize",
});
console.log(normalized);
```

---

## 📞 Getting Help

- **Architecture Q?** → Read [ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md](./ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md)
- **Implementation Q?** → Check [GED_OS_ACTION_PLAN.md](./GED_OS_ACTION_PLAN.md)
- **Vision Q?** → See [GED_OS_DEFINITION.md](./GED_OS_DEFINITION.md)
- **Technical deep-dive?** → [ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md](./ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md)

---

## ✅ Definition of Done

- [ ] Code compiles (TypeScript no errors)
- [ ] Tests pass (unit + integration + E2E)
- [ ] No regression in electricity domain
- [ ] Code reviewed & approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Product approval

---

*GED OS Multidomaine — Une plateforme. Mille solutions.*

**Last updated**: 17 mai 2026

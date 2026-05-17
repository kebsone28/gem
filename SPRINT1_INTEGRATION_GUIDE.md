# GED OS Sprint 1 — Integration Guide

**Status**: Foundation implemented ✅  
**Date**: 17 mai 2026

---

## 📋 Fichiers Créés

### Backend TypeScript/JavaScript

| Fichier | Purpose | Status |
|---------|---------|--------|
| `backend/src/domain-adapters/DomainAdapter.ts` | Abstract interface | ✅ |
| `backend/src/domain-adapters/DomainAdapterFactory.ts` | Registry pattern | ✅ |
| `backend/src/domain-adapters/adapters/ElectrificationAdapter.ts` | Electricity implementation | ✅ |
| `backend/src/services/domain/DomainConfigService.ts` | Config management | ✅ |
| `backend/src/middleware/domainContext.ts` | Request middleware | ✅ |

### Frontend TypeScript

| Fichier | Purpose | Status |
|---------|---------|--------|
| `frontend/src/adapters/DomainRenderAdapter.ts` | Abstract interface | ✅ |
| `frontend/src/adapters/ElectrificationRenderAdapter.ts` | Electricity rendering | ✅ |
| `frontend/src/adapters/DomainRenderAdapterFactory.ts` | Registry pattern | ✅ |

### Database

| Change | Purpose | Status |
|--------|---------|--------|
| `schema.prisma` | Added `DomainConfig` table | ✅ |

---

## 🔌 How to Integrate

### 1. Backend Routes Setup

Add middleware to Express app:

```typescript
// backend/src/app.ts or server.ts

import { domainContext } from './middleware/domainContext';

// Apply domain context middleware AFTER auth
app.use(authMiddleware); // Existing auth
app.use(domainContext);  // NEW: domain context

// Your routes (e.g., households)
app.get('/api/households', getHouseholds);
```

### 2. Using DomainAdapter in Controllers

Example household controller:

```typescript
// backend/src/modules/household/household.controller.js

export const getHouseholds = async (req, res) => {
  try {
    const { organizationId, userId } = req.user;
    const { domainAdapter, domainType } = req; // NEW: from middleware

    // Build query using adapter
    const query = domainAdapter.buildEntityQuery({
      organizationId,
      status: req.query.status,
      search: req.query.search,
    });

    // Execute query
    const households = await prisma.household.findMany({
      where: query.where,
      ...domainAdapter.getOptimalQueryShape(), // NEW: optimized select
      take: 100,
    });

    // Normalize using adapter
    const normalized = await Promise.all(
      households.map(h => domainAdapter.normalizeEntity(h))
    );

    // Validate using adapter
    const validatedHouseholds = normalized.map(h => ({
      ...h,
      alerts: domainAdapter.generateAlerts(h), // NEW: domain alerts
    }));

    res.json({ data: validatedHouseholds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### 3. Frontend: Using DomainRenderAdapter

Update your household/terrain map components:

```typescript
// frontend/src/components/terrain/MapComponent.tsx

import { DomainRenderAdapterFactory } from '@/adapters/DomainRenderAdapterFactory';

export const MapComponent = () => {
  const domainType = 'electricity'; // Or from store/props
  const renderAdapter = DomainRenderAdapterFactory.getAdapter(domainType);

  // Use adapter for rendering
  const features = households.map(h => renderAdapter.toFeature(h));
  
  // Add to map
  map.getSource('households').setData({
    type: 'FeatureCollection',
    features,
  });

  // Handle click
  map.on('click', 'households-layer', (e) => {
    const properties = e.features[0].properties;
    const popupContent = renderAdapter.getPopupContent(properties);
    popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
  });
};
```

---

## 🚀 Next Steps

### Sprint 2: Validation (Week 2-3)

1. **Migrate Prisma**
   ```bash
   cd backend
   npx prisma migrate dev --name add_domain_config
   ```

2. **Test ElectrificationAdapter**
   ```bash
   npm run test:adapters
   ```

3. **Smoke test household endpoints**
   - GET /api/households?domainType=electricity
   - Verify 0 regressions

### Sprint 3: Agriculture Pilote (Week 4-5)

1. Create `FieldAdapter` extending `DomainAdapter`
2. Create Prisma tables (Field, Livestock)
3. Create `FieldService`
4. Implement endpoints
5. Create `AgricultureRenderAdapter`

---

## 📚 Type Definitions

For TypeScript projects, ensure these are imported:

```typescript
// backend
import { DomainAdapter, ValidationError, Alert, NormalizedEntity } from '@/domain-adapters/DomainAdapter';
import { DomainConfigService } from '@/services/domain/DomainConfigService';
import { domainContext } from '@/middleware/domainContext';

// frontend
import { DomainRenderAdapter } from '@/adapters/DomainRenderAdapter';
import { DomainRenderAdapterFactory } from '@/adapters/DomainRenderAdapterFactory';
```

---

## ✅ Validation Checklist

- [ ] Prisma migration runs without error
- [ ] Types compile (TypeScript)
- [ ] ESLint passes
- [ ] ElectrificationAdapter tests pass (85%+)
- [ ] Household endpoints work (?domainType=electricity)
- [ ] No regression in existing functionality
- [ ] Frontend renders with ElectrificationRenderAdapter

---

## 🐛 Debugging

### Type Errors

If you see "DomainConfig not found":
```bash
cd backend
npx prisma generate
```

### Runtime Errors

Enable debug logging:
```bash
export DEBUG=ged-os:*
npm run dev:backend
```

### Test Adapter Directly

```bash
# backend/test-adapter.js
const { ElectrificationAdapter } = require('./src/domain-adapters/adapters/ElectrificationAdapter');
const adapter = new ElectrificationAdapter();

const household = { id: '1', name: 'House', latitude: 14.5, longitude: -13.5 };
console.log(adapter.normalizeEntity(household));
```

---

## 🏁 Definition of Done

- ✅ All 8 files created and compiling
- ✅ DomainAdapter pattern documented
- ✅ ElectrificationAdapter wraps legacy code
- ✅ DomainConfigService operational
- ✅ Middleware integrated
- ✅ Frontend adapters ready
- ⏳ Prisma migration executed
- ⏳ Zero regression tests pass

---

## 📞 Questions?

- **Architecture**: See [ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md](../../ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md)
- **API Examples**: See [DEVELOPER_QUICK_REFERENCE.md](../../DEVELOPER_QUICK_REFERENCE.md)
- **Roadmap**: See [GED_OS_ACTION_PLAN.md](../../GED_OS_ACTION_PLAN.md)

---

*GED OS Foundation Sprint 1 — Ready for testing & validation*

**Created**: 17 mai 2026  
**Next Review**: After Prisma migration (24 mai 2026)

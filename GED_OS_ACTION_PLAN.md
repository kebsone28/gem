# GED OS — Plan d'Action Immédiat

**Objectif** : Transformer GED OS de produit électrification vers plateforme multidomaine.  
**Durée** : 8 semaines (2 mois)  
**Charge estimation** : 320 h (4 devs full-time)

---

## 🏆 Accompli — Kernel Frontend GED OS (Mai 2026)

> Ces tâches ont été réalisées lors de la phase d'industrialisation du Kernel.

- [x] **Kernel Architecture** — `frontend/src/core/` (kernel, router, security, events)
- [x] **ModuleManifest** — Interface déclarative dans `core/kernel/types.ts`
- [x] **Registry décentralisé** — `core/kernel/registry.ts` + 32 `manifest.ts` individuels
- [x] **AppRouter** — `core/router/AppRouter.tsx` piloté par le registry
- [x] **Security Engine** — `core/security/permissions.ts` + `core/security/types.ts`
- [x] **Migration physique** — `src/pages/` **vidé** — toutes les vues dans `src/modules/[nom]/views/`
- [x] **EventBus** — `core/events/EventBus.ts` avec catalogue `KERNEL_EVENTS` (25 types)
- [x] **KernelOrchestrator** — `core/events/KernelOrchestrator.ts` branché dans `App.tsx`
- [x] **useEventBus** — `hooks/useEventBus.ts` avec cleanup automatique

## 🏆 Accompli — Backend Domain Adapters (Mai 2026)

- [x] **DomainAdapter** — Interface abstraite `backend/src/domain-adapters/DomainAdapter.ts`
- [x] **ElectrificationAdapter** — `adapters/ElectrificationAdapter.ts` (Household/GEM)
- [x] **AgricultureAdapter** — `adapters/AgricultureAdapter.ts` (Fields, Crops, Livestock)
- [x] **HealthAdapter** — `adapters/HealthAdapter.ts` (HealthCenters, Campaigns)
- [x] **LogisticsAdapter** — `adapters/LogisticsAdapter.ts` (Warehouses, Shipments, Stock)
- [x] **HighVoltageAdapter** — `adapters/HighVoltageAdapter.ts` (Substations, Pylons)
- [x] **SolarAdapter** — `adapters/SolarAdapter.ts` (Mini-grids, Home Systems)
- [x] **TargetingAdapter** — `adapters/TargetingAdapter.ts` (Eligibility, Surveys)
- [x] **DataCollectionAdapter** — `adapters/DataCollectionAdapter.ts` (Campaigns, Quality)
- [x] **DomainAdapterFactory** — Tous les 8 adapters enregistrés
- [x] **DomainConfigService** — `services/domain/DomainConfigService.ts`
- [x] **DomainContext middleware** — `middleware/domainContext.ts`
- [x] **DomainConfig Prisma** — Table `DomainConfig` en base

### 📁 Architecture Actuelle
```
backend/src/
├── domain-adapters/
│   ├── DomainAdapter.ts           ← Interface abstraite
│   ├── DomainAdapterFactory.ts    ← Registry + auto-registration
│   └── adapters/
│       ├── ElectrificationAdapter.ts  ← electricity (GEM)
│       ├── AgricultureAdapter.ts      ← agriculture (Fields, Crops)
│       ├── HealthAdapter.ts           ← health (HealthCenters, Campaigns)
│       ├── LogisticsAdapter.ts        ← logistics (Warehouses, Shipments)
│       ├── HighVoltageAdapter.ts      ← high_voltage (Substations, Pylons)
│       ├── SolarAdapter.ts            ← solar (Mini-grids, Home Systems)
│       ├── TargetingAdapter.ts        ← targeting (Eligibility, Surveys)
│       └── DataCollectionAdapter.ts   ← data_collection (Surveys, Census)
├── middleware/
│   └── domainContext.ts           ← Injecte req.domainConfig
└── services/domain/
    └── DomainConfigService.ts     ← CRUD configs par domaine

frontend/src/
├── core/
│   ├── kernel/registry.ts         ← 32 modules plug-and-play
│   ├── router/AppRouter.tsx        ← Routeur Kernel
│   ├── security/permissions.ts    ← IAM Engine
│   └── events/
│       ├── EventBus.ts            ← PubSub typé (25 KERNEL_EVENTS)
│       └── KernelOrchestrator.ts  ← Règles réactives cross-modules
├── modules/                       ← 32 modules isolés
│   ├── terrain/manifest.ts + views/
│   ├── mission/manifest.ts + views/
│   └── ... (30 autres)
└── hooks/useEventBus.ts           ← Hook React abonnements
```

---

## Sprint 2 : Électrification Validation & Tests (Semaine 2–3)

### 🧪 Validation

- [ ] **Tests régression électrification**
  - Exécuter suite tests : `cd backend && npm test`
  - Vérifier `ElectrificationAdapter` — aucune régression
  - Coverage min 85%

- [ ] **Staging deployment**
  - Déployer branche `develop` vers staging
  - 24h smoke tests
  - Feedback équipe terrain

- [ ] **Performance baseline**
  - Mesurer temps requêtes avec DomainContext middleware
  - Documenter baseline pour comparaison futurs domaines

### 📚 Documentation

- [ ] Créer `ARCHITECTURE_MULTIDOMAINE.md` détaillant :
  - DomainAdapter pattern + exemples
  - EventBus inter-modules
  - DomainConfig schema
  - Guide ajout d'un nouveau domaine en 2h

---

## Sprint 3 : Agriculture Pilote (Semaine 3–5)

### 🌾 Implémentation Agriculture Frontend

- [ ] **Prisma : Field & Livestock tables**
  - Fichier : `backend/prisma/schema.prisma`
  - Migration : `npx prisma migrate dev --name add_field_livestock`

- [ ] **API endpoints Agriculture**
  - `backend/src/routes/fields.ts`
  - `POST /api/fields` — créer parcelle
  - `GET /api/fields` — lister avec filtres
  - `PUT /api/fields/:id` — update
  - `GET /api/fields/:id/alerts` — alertes

- [ ] **Services métier**
  - `backend/src/services/agriculture/FieldService.ts`
  - `backend/src/services/agriculture/CropYieldCalculator.ts`

- [ ] **Frontend : Module Agriculture**
  - Créer `frontend/src/modules/agriculture/manifest.ts`
  - Créer `frontend/src/modules/agriculture/views/Fields.tsx`
  - Utiliser `EntityLayer` avec `domainType='agriculture'`

- [ ] **EventBus — intégration Agriculture**
  - Émettre `KERNEL_EVENTS.TERRAIN_DATA_UPDATED` quand parcelle change de statut
  - Émettre `KERNEL_EVENTS.STOCK_ALERT` si rendement < 70% des estimations

---

## Sprint 4 : Santé (Semaine 5–6)

### 🏥 Implémentation Santé

- [ ] **Prisma : HealthCenter & Campaign tables**
  - `backend/prisma/schema.prisma`
  - Migration : `npx prisma migrate dev --name add_health`

- [ ] **API endpoints Santé**
  - `backend/src/routes/health.ts`
  - `/api/health-centers` CRUD
  - `/api/campaigns` CRUD

- [ ] **Frontend : Module Santé**
  - `frontend/src/modules/health/manifest.ts`
  - `frontend/src/modules/health/views/HealthCenters.tsx`

---

## Sprint 5 : Logistique Enrichie (Semaine 6–7)

### 📦 Implémentation Logistique Enrichie

- [ ] **Prisma : Warehouse & Shipment tables**
  - `backend/prisma/schema.prisma`
  - Migration : `npx prisma migrate dev --name add_warehouse_shipment`

- [ ] **API endpoints**
  - `backend/src/routes/logistics.ts`
  - `/api/warehouses` CRUD + `/api/shipments` CRUD

- [ ] **Frontend : Vues Warehouse**
  - `frontend/src/modules/logistique/views/Warehouse.tsx`
  - Enrichir `modules/logistique/manifest.ts`

---

## Sprint 6 : Dashboard Multidomaine (Semaine 7–8)

### 📊 Dashboard Configurable

- [ ] **Widgets par domaine**
  - `frontend/src/modules/dashboard/views/DashboardViews/`
  - Agriculture : yield trends, crop calendar
  - Santé : vaccination coverage, outbreak map
  - Logistique : stock levels, shipment tracking

- [ ] **EntityLayer générique**
  - `frontend/src/components/domain/EntityLayer.tsx`
  - Remplace `HouseholdLayer` pour tous domaines

- [ ] **Configuration UI multidomaine**
  - Admin panel — `frontend/src/modules/settings/views/`
  - Drag-drop widgets, filtres par domaine

---

## Métriques de Succès

| Métrique | Cible | Status |
|----------|-------|--------|
| **Électrification régression** | 0 dégradations | ✅ Build 0 erreurs |
| **Code sharing** | 60%+ modules communs | ✅ Architecture Kernel |
| **Domaines actifs** | 8 (electricity, agriculture, health, logistics, high_voltage, solar, targeting, data_collection) | ✅ Adapters créés |
| **Performance** | < 500ms requêtes | ⏳ À mesurer |
| **Test coverage** | 85%+ global | ⏳ À écrire |
| **Time-to-domain** | 2 semaines par domaine | ✅ Pattern établi |
| **Déploiement agriculture** | Semaine 5 | ⏳ Sprint 3 |

---

## Ressources & Chemins Clés

### 🔧 Backend
| Composant | Chemin |
|-----------|--------|
| DomainAdapter (interface) | `backend/src/domain-adapters/DomainAdapter.ts` |
| DomainAdapterFactory | `backend/src/domain-adapters/DomainAdapterFactory.ts` |
| ElectrificationAdapter | `backend/src/domain-adapters/adapters/ElectrificationAdapter.ts` |
| AgricultureAdapter | `backend/src/domain-adapters/adapters/AgricultureAdapter.ts` |
| HealthAdapter | `backend/src/domain-adapters/adapters/HealthAdapter.ts` |
| LogisticsAdapter | `backend/src/domain-adapters/adapters/LogisticsAdapter.ts` |
| HighVoltageAdapter | `backend/src/domain-adapters/adapters/HighVoltageAdapter.ts` |
| SolarAdapter | `backend/src/domain-adapters/adapters/SolarAdapter.ts` |
| TargetingAdapter | `backend/src/domain-adapters/adapters/TargetingAdapter.ts` |
| DataCollectionAdapter | `backend/src/domain-adapters/adapters/DataCollectionAdapter.ts` |
| DomainConfigService | `backend/src/services/domain/DomainConfigService.ts` |
| DomainContext middleware | `backend/src/middleware/domainContext.ts` |

### 🔧 Frontend
| Composant | Chemin |
|-----------|--------|
| Kernel Registry | `frontend/src/core/kernel/registry.ts` |
| AppRouter | `frontend/src/core/router/AppRouter.tsx` |
| Security Engine | `frontend/src/core/security/permissions.ts` |
| EventBus | `frontend/src/core/events/EventBus.ts` |
| KernelOrchestrator | `frontend/src/core/events/KernelOrchestrator.ts` |
| useEventBus hook | `frontend/src/hooks/useEventBus.ts` |
| Modules (32) | `frontend/src/modules/[nom]/` |

### 🔧 Commandes
```bash
# Dev
npm run dev:saas          # Démarrer tout (racine)

# Backend
cd backend
npm test                  # Tests
npx prisma migrate dev    # Migration DB
npx prisma studio         # Voir les données

# Frontend
cd frontend
npm run build             # Build production
npm run dev               # Dev server seul
```

### 📚 Documentation
- [GED_OS_DEFINITION.md](./GED_OS_DEFINITION.md) — Vision et définition
- [GED_OS_IMPLEMENTATION_ROADMAP.md](./GED_OS_IMPLEMENTATION_ROADMAP.md) — Roadmap technique
- [GED_OS_SHORT.md](./GED_OS_SHORT.md) — Résumé exécutif
- [Prisma Docs](https://www.prisma.io/docs/)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Régression électrification** | Critique | Tests exhaustifs + staging 2 semaines |
| **Performance dégradation** | Haute | Benchmarking baseline, index DB |
| **Complexity architecturale** | Faible ✅ | Kernel pattern documenté, adapters uniformes |

---

*GED OS — Kernel Frontend opérationnel. 8 domaines backend actifs. Sprint Agriculture en cours.*

**Last updated** : 17 mai 2026 — v3.1 (8 Domain Adapters + Kernel v2 complet)

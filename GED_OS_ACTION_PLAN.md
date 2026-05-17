# GED OS — Plan d'Action Immédiat

**Objectif** : Transformer GED OS de produit électrification vers plateforme multidomaine.  
**Durée** : 8 semaines (2 mois)  
**Charge estimation** : 320 h (4 devs full-time)

---

## Sprint 1 : Foundation (Semaine 1–2)

### 📋 Tâches Backend

- [ ] **Prisma Schema : DomainConfig table**
  - Créer migration `20260520_add_domain_config.sql`
  - Ajouter à `schema.prisma` :
    ```prisma
    model DomainConfig {
      id                String    @id @default(uuid())
      organizationId    String
      domainType        String    // "electricity" | "agriculture" | "health" | etc.
      
      entityFields      Json      // {"fields": ["name", "status", "voltage"]}
      statusEnum        String[]  
      priorityRules     Json      
      validationSchemas Json      
      projectTemplates  Json
      missionTemplates  Json
      
      createdAt         DateTime  @default(now())
      updatedAt         DateTime  @updatedAt
      
      @@unique([organizationId, domainType])
    }
    ```
  - Lancer migration Prisma
  - Valider no errors

- [ ] **Service : DomainConfigService**
  - Fichier : `/backend/src/services/domain/DomainConfigService.js`
  - Méthodes : `getDomainConfig()`, `saveDomainConfig()`, `getStatusEnum()`, `validateEntity()`
  - Tests : `/backend/__tests__/services/DomainConfigService.test.js`

- [ ] **Factory : DomainAdapterFactory**
  - Fichier : `/backend/src/domain-adapters/DomainAdapterFactory.js`
  - Interface abstraite `DomainAdapter` avec méthodes clés
  - Implémentation `ElectrificationAdapter` (wrapping logique existante)

- [ ] **Middleware : DomainContext**
  - Fichier : `/backend/src/middleware/domainContext.js`
  - Extrait `domainType` de headers ou project config
  - Charge `DomainConfig` et injecte dans `req.domainConfig`

### 📋 Tâches Frontend

- [ ] **Component : EntityLayer générique**
  - Transformer `HouseholdLayer.tsx` → `EntityLayer.tsx`
  - Paramètres génériques : `entityType`, `domainType`
  - S'adapte dynamiquement aux champs

- [ ] **Store update : terrainUIStore**
  - Ajouter `activeDomainType` (default: 'electricity')
  - Ajouter `domainConfig` pour stockage config actif

- [ ] **Config : mapConfig.ts update**
  - Ajouter palettes couleur par domaine
  - Icons dynamiques par domaine (pas juste status)

### 📋 Documentation

- [ ] Ajouter section "Feuille de Route" à GED_OS_DEFINITION.md ✅
- [ ] Créer GED_OS_IMPLEMENTATION_ROADMAP.md ✅
- [ ] Créer ce fichier (GED_OS_ACTION_PLAN.md)

---

## Sprint 2 : Électrification Validation (Semaine 2–3)

### 🧪 Validation

- [ ] **Tests régression électrification**
  - Exécuter suite tests existante
  - Aucune régression autorisée
  - Coverage min 85%

- [ ] **Staging deployment**
  - Déployer branche develop vers staging
  - 24h smoke tests
  - Feedback équipe terrain

- [ ] **Performance baseline**
  - Mesurer temps requêtes électrification avant/après
  - Documenter baseline pour futur comparaison

### 📚 Documentation Architecturale

- [ ] Créer `ARCHITECTURE_MULTIDOMAINE.md` détaillant :
  - DomainAdapter pattern
  - DomainConfig schema
  - Event publishing flow
  - Database design rationale

---

## Sprint 3 : Agriculture Pilote (Semaine 3–5)

### 🌾 Implémentation Agriculture

- [ ] **Prisma : Field & Livestock tables**
  - Migration pour nouvelles entités
  - Indices optimisées pour requêtes terrain

- [ ] **Backend : AgricultureAdapter**
  - Implémentation DomainAdapter pour agriculture
  - Normalization champs spécifiques (crop, soil, etc.)
  - Validation règles métier

- [ ] **API endpoints**
  - `POST /api/fields` - créer parcelle
  - `GET /api/fields` - lister avec filtres
  - `PUT /api/fields/{id}` - update
  - `GET /api/fields/{id}/alerts` - alertes associées

- [ ] **Services**
  - `FieldService.js` - logique métier
  - `CropYieldCalculator.js` - estimations rendement
  - `AgriculturalAlertEngine.js` - génération alertes

- [ ] **Frontend : FieldsPage**
  - Component liste parcelles
  - Carte intégrée (EntityLayer agriculture)
  - Dashboard rendements / alertes

- [ ] **Tests**
  - Unit tests : 85%+ coverage
  - Integration tests : field creation → alerts
  - E2E : user journey (create field → monitor → alert)

---

## Sprint 4 : Santé (Semaine 5–6)

### 🏥 Implémentation Santé

- [ ] **Prisma : HealthCenter & Campaign tables**
- [ ] **Backend : HealthAdapter**
- [ ] **API endpoints**
- [ ] **Frontend : HealthPage**
- [ ] **Tests**

---

## Sprint 5 : Logistique (Semaine 6–7)

### 📦 Implémentation Logistique

- [ ] **Prisma : Warehouse & Shipment tables**
- [ ] **Backend : LogisticsAdapter**
- [ ] **API endpoints**
- [ ] **Frontend : WarehousePage + Tracking**
- [ ] **Tests**

---

## Sprint 6 : Dashboard Multidomaine (Semaine 7–8)

### 📊 Dashboard Configurable

- [ ] **Dashboard component générique**
  - Espace pour widgets configurable
  - Widgets par domaine

- [ ] **Widgets implémentation**
  - Électrification : coverage map, status distribution, alerts
  - Agriculture : yield trends, crop calendar, weather integration
  - Santé : vaccination coverage, outbreak alerts, capacity
  - Logistique : shipment tracking, stock levels, delays

- [ ] **Configuration UI**
  - Admin panel pour customize dashboard
  - Drag-drop widgets
  - Filtres par domaine

---

## Checklist Go-Live Multidomaine

### Électrification v2 (Multidomaine-compatible)
- [ ] Aucune régression
- [ ] Tests complets passent
- [ ] Documentation à jour
- [ ] Formation team complète
- [ ] Déploiement production

### Agriculture Pilote
- [ ] MVP fonctionnel (create, read, list, alerts)
- [ ] Partenaire initial identifié (NGO, gouvernement, etc.)
- [ ] 100+ parcelles testées
- [ ] Feedback collecté

### Santé & Logistique
- [ ] Specs finalisées avec stakeholders
- [ ] Prototypes validés
- [ ] Team recrutées

---

## Métriques de Succès

| Métrique | Cible | Status |
|----------|-------|--------|
| **Électrification régression** | 0 dégradations | ⏳ |
| **Code sharing** | 60%+ modules communs | ⏳ |
| **Performance** | < 500ms requêtes | ⏳ |
| **Test coverage** | 85%+ global | ⏳ |
| **Time-to-domain** | 2 semaines par domaine | ⏳ |
| **Déploiement agriculture** | Semaine 5 | ⏳ |

---

## Ressources

### 👥 Team
- **1 Lead architect** — Direction, revues
- **2 Backend devs** — Core + agriculture
- **1 Frontend dev** — UI générique + dashboards
- **1 DevOps/QA** — Migrations, tests, déploiement

### 📚 Documentation Référence
- [GED_OS_DEFINITION.md](./GED_OS_DEFINITION.md)
- [GED_OS_IMPLEMENTATION_ROADMAP.md](./GED_OS_IMPLEMENTATION_ROADMAP.md)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Event-Driven Architecture](https://www.martinfowler.com/articles/201701-event-driven.html)

### 🔧 Tools
- Prisma Studio : `npx prisma studio`
- Backend tests : `npm run test` (backend)
- Frontend tests : `npm run test:unit` (frontend)
- E2E tests : `npm run test:e2e`

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Régression électrification** | Critique | Tests exhaustifs + staging 2 semaines |
| **Performance dégradation** | Haute | Benchmarking baseline, index DB optimization |
| **Complexity architecturale** | Moyenne | Patterns simples, documentation claire |
| **Shortage talent** | Moyenne | Outsourcing possible, modularité aide |

---

## Approvals Requis

- [ ] CTO/Tech Lead — Architecture approuvée
- [ ] Product — Priorités domaines confirmées
- [ ] Ops — Infrastructure scaling plan
- [ ] Finance — Budget approuvé

---

*GED OS — De l'électrification vers multidomaine. Étape 1 : Foundation.*

**Last updated** : 17 mai 2026

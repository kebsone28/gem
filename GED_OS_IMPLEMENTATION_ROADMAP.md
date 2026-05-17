# GED OS — Feuille de Route Réalisation

**Objectif** : Transformer le produit existant (GEM = électrification) en plateforme générique GED OS capable de supporter multiples domaines.

**État actuel** : Électrification fonctionnelle (50k+ ménages Sénégal) avec architecture modulaire extensible.

**Vision** : Plateforme multidomaine souveraine, modulaire, event-driven.

---

## Phase 1 : Généraliser les Concepts (Semaines 1–2)

### 1.1. Renommer les Entités Clés
Passer d'une modélisation spécifique électrification à une modélisation générique par domaine.

| Actuel (GEM) | Générique GED OS | Usage |
|--------------|------------------|-------|
| `Household` | `Entity` (ou `DomainEntity`) | Objet principal de suivi par domaine |
| `Zone` | `Zone` / `Territory` | Zone administrative ou géographique |
| `Grappe` | `Cluster` / `Grouping` | Groupement d'entités (géo ou logique) |
| `Mission` | `Mission` / `Task` | Action/opération terrain |
| `Monitoring` | `Monitoring` / `Observation` | Suivi entités |

**Actions** :
- ✅ Créer entités alias génériques dans Prisma (migrations progressives)
- ✅ Déterminer : `Entity` ou domaine-specific (`Household`, `HealthCenter`, `Field`, etc.) ?
  - **Recommandation** : Garder `Household` pour électrification, créer tables spécialisées par domaine, une table `DomainEntity` centrale pour requêtes cross-domaine

### 1.2. Créer Modèle `DomainConfig`
Nouvelle table Prisma stockant configuration par domaine :

```prisma
model DomainConfig {
  id                    String   @id @default(uuid())
  organizationId        String
  domainType            String   // "electricity", "agriculture", "health", etc.
  
  // Champs dynamiques par domaine
  entityFields          Json     // Noms des champs monitoriés (status, voltage, etc.)
  statusEnum            String[] // États possibles pour cette domaine
  priorityRules         Json     // Règles d'alerte/priorité
  validationSchemas     Json     // Schémas de validation
  
  // Templates
  projectTemplates      Json     // Modèles de projet pour ce domaine
  missionTemplates      Json     // Modèles de mission
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([organizationId, domainType])
}
```

**Actions** :
- Créer migration Prisma pour `DomainConfig`
- Créer service `domainConfigService.ts` pour gestion configs
- Implémenter `DomainContext` middleware Express pour charger config active par requête

### 1.3. Créer `DomainAdapter` Pattern
Classe abstraite pour adapter les services à chaque domaine.

```typescript
// backend/src/services/DomainAdapter.ts
export abstract class DomainAdapter {
  abstract domainType: string;
  
  // Normalization
  abstract normalizeEntity(rawData: any): any;
  
  // Validation
  abstract validateEntity(entity: any): ValidationError[];
  
  // Status rules
  abstract deriveStatus(entity: any): string;
  
  // Alerts
  abstract generateAlerts(entity: any): Alert[];
  
  // Custom fields handling
  abstract getEntityFields(): string[];
}
```

**Implémentations** :
- `ElectrificationAdapter` (GEM actuel)
- `HealthAdapter` (Santé)
- `AgricultureAdapter` (Agriculture)

---

## Phase 2 : Abstraction Infrastructure (Semaines 2–3)

### 2.1. Généraliser `Household` → `Entity`
- Créer table `Entity` avec `discriminator` (type + domainType)
- Migration progressive : 
  - `Entity` reste optionnelle
  - `Household` continue fonctionner
  - Services utilisent abstraction commune

```prisma
model Entity {
  id              String      @id @default(uuid())
  type            String      // "household" | "healthCenter" | "field" | etc.
  domainType      String      // "electricity" | "health" | "agriculture"
  organizationId  String
  projectId       String?
  
  // Données génériques
  name            String?
  phone           String?
  location        Json        // {lat, lng, wkt, etc.}
  status          String      // Dépend du domaine
  
  // Données domaine-spécifiques (JSONB)
  domainData      Json        @default("{}")
  
  // Standard traçabilité
  metadata        Json        @default("{}")
  alerts          Json        @default("[]")
  version         Int         @default(1)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deletedAt       DateTime?
  
  @@index([domainType, organizationId])
  @@index([projectId, domainType])
}
```

### 2.2. Généraliser `Zone` → Territoire
- Supports multi-hiérarchies (administrative, opérationnelle, géographique)
- Configuration flexible par domaine

```prisma
model Territory {
  id                String      @id @default(uuid())
  organizationId    String
  
  name              String
  type              String      // "region" | "province" | "district" | "zone" | custom
  parentTerritoryId String?
  
  geometry          Unsupported("geometry")?
  centroid          Json?       // {lat, lng}
  
  // Metadata
  config            Json        @default("{}")
  metadata          Json        @default("{}")
  
  @@index([organizationId, type])
  @@tree([parentTerritoryId])
}
```

### 2.3. Event-Driven Architecture
- Service `EventPublisher` centralisé pour tous domaines
- Événements standardisés :

```typescript
type DomainEvent = {
  id: string;
  timestamp: Date;
  domainType: string;
  entityType: string;
  entityId: string;
  eventType: string; // "created" | "updated" | "status_changed" | "alert_triggered"
  previousState?: any;
  newState: any;
  userId: string;
  metadata?: any;
}
```

**Emetteurs** : Entity creation/update, Alert generation, Status change
**Consommateurs** : Monitoring, Audit, Notifications, Workflows

---

## Phase 3 : Implémentation Domaines Spécialisés (Semaines 4–6)

### 3.1. Agriculture
**Entités** : `Field` (parcelle), `Crop` (culture), `Livestock` (élevage)

```prisma
model Field {
  id              String    @id @default(uuid())
  organizationId  String
  projectId       String?
  
  name            String
  owner           Json      // {name, phone, id}
  geometry        Unsupported("geometry")?
  area            Float     // hectares
  
  currentCrop     String    // type de culture
  soilType        String
  waterSource     String    // "rain" | "well" | "irrigation"
  
  cropData        Json      // {plantedDate, expectedHarvest, estimatedYield}
  productionData  Json      // {actualYield, harvest, losses}
  
  status          String    // "prepared" | "planted" | "growing" | "ready" | "harvested"
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Livestock {
  id              String    @id @default(uuid())
  organizationId  String
  projectId       String?
  
  name            String
  owner           Json      // {name, phone}
  type            String    // "cattle" | "goat" | "sheep" | etc.
  
  herdData        Json      // {count, breeds, weights}
  healthData      Json      // {vaccinations, diseases, treatments}
  
  status          String    // "healthy" | "sick" | "alert"
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### 3.2. Santé
**Entités** : `HealthCenter`, `Patient`, `Campaign` (vaccination), `Outbreak`

```prisma
model HealthCenter {
  id              String      @id @default(uuid())
  organizationId  String
  projectId       String?
  
  name            String
  type            String      // "clinic" | "hospital" | "maternity"
  location        Json        // {lat, lng}
  
  // Infrastructure
  beds            Int
  equipment       Json        // {microscope, xray, etc.}
  medications     Json        // {inventory}
  
  // Staffing
  staff           Json        // [{name, role, phone}]
  
  status          String      // "operational" | "understaffed" | "closed"
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model Campaign {
  id              String      @id @default(uuid())
  organizationId  String
  
  name            String
  type            String      // "vaccination" | "screening" | "treatment"
  disease         String      // "polio" | "covid" | "malaria"
  
  startDate       DateTime
  endDate         DateTime
  
  coverage        Json        // {target: 10000, vaccinated: 8500, rate: 85}
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

### 3.3. Logistique
**Entités** : `Warehouse`, `Stock`, `Shipment`

```prisma
model Warehouse {
  id              String      @id @default(uuid())
  organizationId  String
  projectId       String?
  
  name            String
  location        Json
  capacity        Float       // tonnes
  
  stockData       Json        // {items: [{name, qty, minAlert}]}
  
  status          String      // "operational" | "understocked" | "full"
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model Shipment {
  id              String      @id @default(uuid())
  organizationId  String
  
  fromWarehouse   String
  toLocation      Json        // {lat, lng, address}
  
  items           Json        // [{product, qty, weight}]
  driver          Json        // {name, phone, plate}
  
  status          String      // "pending" | "in_transit" | "delivered" | "delayed"
  trackingData    Json        // {gps, photos, notes}
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

---

## Phase 4 : Frontend Multidomaine (Semaines 5–7)

### 4.1. Adapter MapLibre aux Domaines
- Changer `HouseholdLayer` → `EntityLayer` (générique)
- Configuration styles par domaine dans `mapConfig.ts`
- Icons/colors dynamiques selon domaine

### 4.2. Dashboard Configurable
- Widgets par domaine (agriculture : rendements, santé : couverture, etc.)
- Configurable dans `DomainConfig`

### 4.3. Formulaires Dynamiques
- JSON Schema pour chaque domaine
- Auto-génération formulaires from `domainData` structure

---

## Phase 5 : Conformité & Sécurité (Semaines 6–8)

### 5.1. Multi-Tenancy Renforcée
- Séparation données par organisation + domaine
- Row-level security Postgresql

### 5.2. Audit & Traçabilité
- `EventLog` pour tous domaines
- `AuditLog` pour accès sensibles

### 5.3. Compliance
- RGPD : droit à l'oubli
- Normes sectorielles (OMS santé, FAO agriculture, etc.)

---

## Priorités Immédiates (Prochaines 2 Semaines)

**Sprint 1 : Foundation**
1. ✅ Créer `DomainConfig` table + service
2. ✅ Implémenter `DomainAdapter` pattern
3. ✅ Créer `EntityLayer` générique frontend

**Sprint 2 : Validation**
1. Tester électrification avec nouveaux abstractions
2. Implémenter agriculture pilote
3. Valider architecture avec stakeholders

**Sprint 3 : Expansion**
1. Domaines santé + logistique
2. Dashboard multidomaine
3. Documentation API générique

---

## Success Metrics

- ✅ Électrification fonctionne sans régressions
- ✅ Agriculture déployable en < 2 semaines
- ✅ Code-sharing 60%+ entre domaines
- ✅ Performance maintenue (< 500ms requêtes)
- ✅ Couverture tests > 80%

---

## Resources

- **DomainAdapter implementations** : `/backend/src/domain-adapters/`
- **Generic services** : `/backend/src/services/`
- **Frontend components** : `/frontend/src/components/domain/`
- **Tests** : `/backend/__tests__/domain-*.test.js`

---

*GED OS Multidomaine — Une plateforme. Mille solutions.*

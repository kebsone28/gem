# Architecture Multidomaine — Guide Technique

**Public** : Développeurs backend & frontend  
**Objectif** : Expliquer la stratégie d'adaptation du code électrification vers multidomaine  
**Référence** : [GED_OS_IMPLEMENTATION_ROADMAP.md](./GED_OS_IMPLEMENTATION_ROADMAP.md) et [GED_OS_ACTION_PLAN.md](./GED_OS_ACTION_PLAN.md)

---

## 1. Principes d'Adaptation

### 1.1. Maintenir Électrification Stable
- **Pas de breaking changes** — Électrification continue fonctionner à l'identique
- **Backward compatible** — Anciennes APIs restent disponibles
- **Feature flags** — Nouvelles domaines optionnels par config

### 1.2. Généraliser Progressivement
```
GEM Spécifique     →    Adapter Pattern    →    Multidomaine Générique
(Household)              (DomainAdapter)         (Entity + EntityLayer)
    ↓                         ↓                         ↓
Ancien code              Wrapper/Legacy            Nouveau code
```

### 1.3. Layers d'Adaptation

```
┌─────────────────────────────────────┐
│     Frontend (React)                 │
│  - EntityLayer (générique)          │
│  - DomainPage (par domaine)         │
│  - Dashboard (configurable)         │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│     API/Controllers                  │
│  - Generic endpoints                 │
│  - Domain-specific routes            │
│  - DomainContext middleware          │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│     Adapters Layer                   │
│  - ElectrificationAdapter            │
│  - AgricultureAdapter                │
│  - HealthAdapter                     │
│  - LogisticsAdapter                  │
│  - (AbstractDomainAdapter)           │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│     Services/Business Logic          │
│  - HouseholdService (legacy)         │
│  - FieldService                      │
│  - HealthCenterService               │
│  - WarehouseService                  │
│  - GenericEntityService              │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│     Database (Prisma)                │
│  - Household (existing)              │
│  - Field / Livestock (new)           │
│  - HealthCenter / Campaign (new)     │
│  - Warehouse / Shipment (new)        │
│  - DomainConfig (new)                │
│  - Entity (optional, future)         │
└─────────────────────────────────────┘
```

---

## 2. Implementation Pattern : DomainAdapter

### 2.1. Interface Abstraite

```typescript
// backend/src/domain-adapters/DomainAdapter.ts

export interface DomainAdapter {
  /**
   * Identifiant unique du domaine
   * "electricity" | "agriculture" | "health" | "logistics"
   */
  domainType: string;

  /**
   * Normalize données brutes vers format standard
   * @param rawData - données source (Kobo, API externe, formulaire)
   * @returns Entity normalisée
   */
  normalizeEntity(rawData: any): Promise<NormalizedEntity>;

  /**
   * Valider entité selon règles métier
   * @param entity - entité à valider
   * @returns array erreurs validation (empty = valide)
   */
  validateEntity(entity: any): ValidationError[];

  /**
   * Dériver status à partir données
   * Logique : règles métier spécifiques domaine
   * @param entity
   * @returns status string ("active" | "alert" | etc.)
   */
  deriveStatus(entity: any): string;

  /**
   * Générer alertes pour entité
   * @param entity
   * @returns array alertes
   */
  generateAlerts(entity: any): Alert[];

  /**
   * Champs monitoriés pour domaine
   * @returns noms champs à afficher/suivre
   */
  getEntityFields(): string[];

  /**
   * Esquisse de requête pour liste entités
   * @returns Prisma select/include pour optimiser perf
   */
  getOptimalQueryShape(): any;
}
```

### 2.2. Implémentation Électrification (Legacy Wrapper)

```typescript
// backend/src/domain-adapters/ElectrificationAdapter.ts

export class ElectrificationAdapter implements DomainAdapter {
  domainType = "electricity";

  async normalizeEntity(rawData: any) {
    // Wrapper autour logic Household existante
    const household = await HouseholdService.normalize(rawData);
    
    return {
      id: household.id,
      name: household.name,
      location: household.location,
      status: household.status,
      domainData: {
        numeroordre: household.numeroordre,
        owner: household.owner,
        koboData: household.koboData,
        // ...
      },
    };
  }

  validateEntity(entity: any): ValidationError[] {
    return HouseholdService.validate(entity); // Reuse existing validation
  }

  deriveStatus(entity: any): string {
    return HouseholdService.deriveStatus(entity.domainData);
  }

  generateAlerts(entity: any): Alert[] {
    return HouseholdService.generateAlerts(entity.domainData);
  }

  getEntityFields() {
    return [
      "name",
      "numeroordre",
      "phone",
      "status",
      "voltage",
      "connectionDate",
    ];
  }

  getOptimalQueryShape() {
    return {
      include: {
        koboData: true,
        owner: true,
        // ... etc
      },
    };
  }
}
```

### 2.3. Nouvelle Implémentation : Agriculture

```typescript
// backend/src/domain-adapters/AgricultureAdapter.ts

export class AgricultureAdapter implements DomainAdapter {
  domainType = "agriculture";

  async normalizeEntity(rawData: any) {
    const field = await FieldService.normalize(rawData);
    
    return {
      id: field.id,
      name: field.name,
      location: { lat: field.latitude, lng: field.longitude },
      status: this.deriveStatus(field),
      domainData: {
        type: "field",
        crop: field.currentCrop,
        soilType: field.soilType,
        area: field.area,
        owner: field.owner,
        // ...
      },
    };
  }

  validateEntity(entity: any): ValidationError[] {
    const errors = [];
    
    if (!entity.name) errors.push({ field: "name", message: "Required" });
    if (!entity.location?.lat) errors.push({ field: "location", message: "Required" });
    if (entity.domainData.area <= 0) 
      errors.push({ field: "area", message: "Must be > 0" });
    
    return errors;
  }

  deriveStatus(entity: any): string {
    const { currentCrop, status, productionData } = entity.domainData;
    
    if (!currentCrop) return "idle";
    if (status === "harvested") return "ready";
    if (productionData?.losses > entity.domainData.area * 0.3) return "alert";
    
    return "active";
  }

  generateAlerts(entity: any): Alert[] {
    const alerts: Alert[] = [];
    
    // Water source alert
    if (entity.domainData.waterSource === "rain" && this.isOffseason()) {
      alerts.push({
        type: "water_shortage",
        severity: "high",
        message: "No rain expected this period",
      });
    }
    
    // Pest alert (if linked to monitoring data)
    if (entity.monitoring?.pestDetected) {
      alerts.push({
        type: "pest_outbreak",
        severity: "critical",
        message: "Pest detected — recommend treatment",
      });
    }
    
    return alerts;
  }

  getEntityFields() {
    return [
      "name",
      "owner",
      "crop",
      "soilType",
      "waterSource",
      "area",
      "status",
      "yield",
    ];
  }

  getOptimalQueryShape() {
    return {
      include: {
        monitoring: true,
        productionData: true,
      },
    };
  }

  private isOffseason(): boolean {
    const month = new Date().getMonth();
    return month > 8 || month < 4; // Dry season
  }
}
```

### 2.4. DomainAdapterFactory

```typescript
// backend/src/domain-adapters/DomainAdapterFactory.ts

export class DomainAdapterFactory {
  private static adapters = new Map<string, DomainAdapter>();

  static {
    // Register adapters
    this.register(new ElectrificationAdapter());
    this.register(new AgricultureAdapter());
    this.register(new HealthAdapter());
    this.register(new LogisticsAdapter());
  }

  static register(adapter: DomainAdapter) {
    this.adapters.set(adapter.domainType, adapter);
  }

  static getAdapter(domainType: string): DomainAdapter {
    const adapter = this.adapters.get(domainType);
    
    if (!adapter) {
      throw new Error(`Unknown domain: ${domainType}`);
    }
    
    return adapter;
  }

  static getSupportedDomains(): string[] {
    return Array.from(this.adapters.keys());
  }
}
```

---

## 3. Service Layer : DomainConfigService

```typescript
// backend/src/services/domain/DomainConfigService.ts

export class DomainConfigService {
  /**
   * Charger config domaine pour organisation
   */
  async getConfig(
    organizationId: string,
    domainType: string
  ): Promise<DomainConfig> {
    let config = await prisma.domainConfig.findUnique({
      where: {
        organizationId_domainType: { organizationId, domainType },
      },
    });

    // Fallback : créer config par défaut
    if (!config) {
      config = await this.createDefaultConfig(organizationId, domainType);
    }

    return config;
  }

  /**
   * Créer config par défaut pour domaine
   */
  private async createDefaultConfig(
    organizationId: string,
    domainType: string
  ): Promise<DomainConfig> {
    const defaults = {
      electricity: {
        statusEnum: ["planning", "connected", "maintenance", "disconnected"],
        entityFields: ["name", "numeroordre", "phone", "status", "voltage"],
        priorityRules: { alert_threshold: 0.8, warning_threshold: 0.6 },
      },
      agriculture: {
        statusEnum: ["idle", "active", "ready", "alert"],
        entityFields: ["name", "crop", "area", "status", "yield"],
        priorityRules: { pest_detection: "critical", water_shortage: "high" },
      },
      health: {
        statusEnum: ["operational", "understaffed", "closed"],
        entityFields: ["name", "type", "beds", "status"],
        priorityRules: { stock_below_min: "high" },
      },
      logistics: {
        statusEnum: ["operational", "understocked", "full"],
        entityFields: ["name", "location", "capacity", "status"],
        priorityRules: { delivery_delayed: "high" },
      },
    };

    return prisma.domainConfig.create({
      data: {
        organizationId,
        domainType,
        ...defaults[domainType],
      },
    });
  }

  /**
   * Valider entité selon config
   */
  async validateEntity(
    organizationId: string,
    domainType: string,
    entity: any
  ): Promise<ValidationError[]> {
    const config = await this.getConfig(organizationId, domainType);
    const adapter = DomainAdapterFactory.getAdapter(domainType);

    // Adapter validation
    const errors = adapter.validateEntity(entity);

    // Config validation
    for (const field of config.entityFields) {
      if (!entity[field]) {
        errors.push({ field, message: `Missing required field: ${field}` });
      }
    }

    return errors;
  }
}
```

---

## 4. API Layer : Generic Endpoints + Domain Routes

### 4.1. DomainContext Middleware

```typescript
// backend/src/middleware/domainContext.js

export const domainContext = async (req, res, next) => {
  try {
    // Extract from query or header
    const domainType = req.query.domainType ||
                       req.headers['x-domain-type'] ||
                       'electricity'; // default

    // Load config
    const config = await DomainConfigService.getConfig(
      req.user?.organizationId,
      domainType
    );

    // Inject into request
    req.domainType = domainType;
    req.domainConfig = config;
    req.domainAdapter = DomainAdapterFactory.getAdapter(domainType);

    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

### 4.2. Generic Entity Endpoint

```typescript
// backend/src/routes/entities.js

export const getEntities = async (req, res) => {
  try {
    const { domainType } = req;
    const adapter = req.domainAdapter;

    // Dispatcher par domaine
    const entities = await this.getEntitiesByDomain(domainType, req);

    // Normalize response
    const normalized = entities.map(e => adapter.normalizeEntity(e));

    res.json({ data: normalized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function getEntitiesByDomain(domainType, req) {
  const { organizationId } = req.user;

  switch (domainType) {
    case 'electricity':
      return prisma.household.findMany({
        where: { organizationId },
        take: 100,
      });

    case 'agriculture':
      return prisma.field.findMany({
        where: { organizationId },
        take: 100,
      });

    case 'health':
      return prisma.healthCenter.findMany({
        where: { organizationId },
        take: 100,
      });

    case 'logistics':
      return prisma.warehouse.findMany({
        where: { organizationId },
        take: 100,
      });

    default:
      throw new Error(`Unknown domain: ${domainType}`);
  }
}
```

### 4.3. Routing

```typescript
// backend/src/routes/index.js

router.get('/entities', domainContext, getEntities);
router.post('/entities', domainContext, createEntity);
router.get('/entities/:id', domainContext, getEntity);
router.put('/entities/:id', domainContext, updateEntity);

// Domain-specific routes
router.get('/households', getHouseholds); // Legacy
router.get('/fields', domainContext, getFields);
router.get('/health-centers', domainContext, getHealthCenters);
router.get('/warehouses', domainContext, getWarehouses);

export default router;
```

---

## 5. Frontend : EntityLayer générique

### 5.1. Transformer HouseholdLayer → EntityLayer

```typescript
// frontend/src/components/terrain/layers/EntityLayer.tsx

interface EntityLayerProps {
  entityType: 'household' | 'field' | 'healthCenter' | 'warehouse';
  domainType: 'electricity' | 'agriculture' | 'health' | 'logistics';
  map: maplibregl.Map;
}

export const EntityLayer: React.FC<EntityLayerProps> = ({
  entityType,
  domainType,
  map,
}) => {
  // Load domain config
  const domainConfig = useDomainConfig(domainType);

  // Adapter for rendering
  const renderAdapter = useMemo(
    () => DomainRenderAdapterFactory.getAdapter(domainType),
    [domainType]
  );

  // Setup layer (generic)
  const ensureLayers = () => {
    if (!map.getLayer(`${entityType}-layer`)) {
      map.addLayer({
        id: `${entityType}-layer`,
        type: 'circle',
        source: entityType,
        paint: {
          'circle-radius': 8,
          'circle-color': renderAdapter.getColorByStatus, // Dynamic
          'circle-opacity': 0.8,
        },
      });
    }
  };

  // Setup data (generic)
  const pushData = (entities: any[]) => {
    const features = entities.map(e => renderAdapter.toFeature(e));
    
    const source = map.getSource(entityType) as GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }
  };

  // Setup interaction (generic)
  const setupClickHandlers = () => {
    const handlers = [];
    
    const handleClick = (e: any) => {
      const properties = e.features?.[0]?.properties;
      if (properties) {
        console.log(`Selected ${entityType}:`, properties.id);
        // Emit event or update store
      }
    };

    map.on('click', `${entityType}-layer`, handleClick);
    handlers.push(() => map.off('click', `${entityType}-layer`, handleClick));

    return () => handlers.forEach(h => h());
  };

  // Standard lifecycle
  useEffect(() => {
    ensureLayers();
    pushData(entities);
    return setupClickHandlers();
  }, [entityType, entities]);

  return null; // Layer renders on map
};
```

### 5.2. DomainRenderAdapter Frontend

```typescript
// frontend/src/adapters/DomainRenderAdapter.ts

export interface DomainRenderAdapter {
  getColorByStatus(properties: any): string;
  getIconId(properties: any): string;
  toFeature(entity: any): Feature;
  getPopupContent(entity: any): string;
}

export class ElectrificationRenderAdapter implements DomainRenderAdapter {
  getColorByStatus(properties: any): string {
    const statusColors = {
      connected: '#00ff00',
      maintenance: '#ff9900',
      planning: '#0099ff',
      disconnected: '#ff0000',
    };
    return statusColors[properties.status] || '#cccccc';
  }

  getIconId(properties: any): string {
    return `icon-electricity-${properties.status}`;
  }

  toFeature(household: any): Feature {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [household.longitude, household.latitude],
      },
      properties: {
        id: household.id,
        name: household.name,
        status: household.status,
        voltage: household.voltage,
      },
    };
  }

  getPopupContent(household: any): string {
    return `
      <strong>${household.name}</strong><br/>
      Status: ${household.status}<br/>
      Voltage: ${household.voltage}V
    `;
  }
}

export class AgricultureRenderAdapter implements DomainRenderAdapter {
  getColorByStatus(properties: any): string {
    const statusColors = {
      idle: '#999999',
      active: '#00ff00',
      ready: '#ffff00',
      alert: '#ff0000',
    };
    return statusColors[properties.status] || '#cccccc';
  }

  getIconId(properties: any): string {
    return `icon-agriculture-${properties.crop}`;
  }

  toFeature(field: any): Feature {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [field.longitude, field.latitude],
      },
      properties: {
        id: field.id,
        name: field.name,
        crop: field.currentCrop,
        area: field.area,
        status: field.status,
      },
    };
  }

  getPopupContent(field: any): string {
    return `
      <strong>${field.name}</strong><br/>
      Crop: ${field.currentCrop}<br/>
      Area: ${field.area} ha<br/>
      Status: ${field.status}
    `;
  }
}
```

---

## 6. Database Evolution Strategy

### 6.1. Phase 1 : Additive Only (No Breaking Changes)

```sql
-- Week 1
ALTER TABLE public.organization ADD COLUMN primary_domain VARCHAR DEFAULT 'electricity';

-- Week 2
CREATE TABLE public.domain_config (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  domain_type VARCHAR NOT NULL,
  entity_fields JSONB DEFAULT '{}',
  status_enum TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- ... other config
  UNIQUE(organization_id, domain_type)
);
```

### 6.2. Phase 2 : New Domain Tables

```sql
-- Week 3
CREATE TABLE public.field (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  name VARCHAR,
  geometry GEOMETRY(Point, 4326),
  -- ... agriculture-specific fields
);

CREATE INDEX idx_field_org ON public.field(organization_id);
CREATE INDEX idx_field_geom ON public.field USING GIST(geometry);
```

### 6.3. Phase 3 : Future Optional Generalization

```sql
-- Week 8+ (optional, only if needed)
CREATE TABLE public.entity (
  id UUID PRIMARY KEY,
  type VARCHAR,
  domain_type VARCHAR,
  domain_data JSONB,
  -- ... generic fields
);
```

**Strategy** : Ne pas forcer `entity` générique si `household`, `field`, etc. suffisent.

---

## 7. Migration Path & Backward Compatibility

### 7.1. Feature Flags

```typescript
// backend/src/config/features.ts

export const featureFlags = {
  MULTIDOMAINE_ENABLED: process.env.MULTIDOMAINE_ENABLED === 'true',
  AGRICULTURE_BETA: process.env.AGRICULTURE_BETA === 'true',
  HEALTH_BETA: process.env.HEALTH_BETA === 'true',
  LOGISTICS_BETA: process.env.LOGISTICS_BETA === 'true',
};

// Usage
if (featureFlags.AGRICULTURE_BETA) {
  router.post('/fields', createField);
}
```

### 7.2. API Versioning

```
GET /api/v1/households       → Old (GEM)
GET /api/v2/entities?domain=electricity → New (GED OS)
```

### 7.3. Client Detection

```typescript
// Frontend
const clientVersion = localStorage.getItem('ged-os-version') || 'v1';

if (clientVersion === 'v1') {
  // Old UI (HouseholdLayer, household routes)
  useHouseholdComponent();
} else {
  // New UI (EntityLayer, domain-generic routes)
  useEntityComponent();
}
```

---

## 8. Testing Strategy

### 8.1. Unit Tests : DomainAdapter

```typescript
// backend/__tests__/adapters/ElectrificationAdapter.test.js

describe('ElectrificationAdapter', () => {
  const adapter = new ElectrificationAdapter();

  it('should normalize household', async () => {
    const raw = { id: '123', name: 'House 1', voltage: 230 };
    const normalized = await adapter.normalizeEntity(raw);
    
    expect(normalized.domainData.voltage).toBe(230);
  });

  it('should derive status correctly', () => {
    const entity = { domainData: { voltage: 230, connected: true } };
    const status = adapter.deriveStatus(entity);
    
    expect(status).toBe('connected');
  });

  it('should generate alerts', () => {
    const entity = { domainData: { voltage: 80 } }; // Low voltage
    const alerts = adapter.generateAlerts(entity);
    
    expect(alerts).toContainEqual(
      expect.objectContaining({ type: 'low_voltage' })
    );
  });
});
```

### 8.2. Integration Tests : API Endpoints

```typescript
// backend/__tests__/api/entities.test.js

describe('GET /api/entities', () => {
  it('should return households for electricity domain', async () => {
    const res = await request(app)
      .get('/api/entities?domainType=electricity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('domainData');
  });

  it('should return fields for agriculture domain', async () => {
    const res = await request(app)
      .get('/api/entities?domainType=agriculture')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
```

### 8.3. E2E Tests : User Journeys

```typescript
// frontend/e2e/multidomaine.spec.ts

describe('Multidomaine User Journey', () => {
  it('should switch between domains', async () => {
    // Login
    await page.goto('http://localhost:5174/login');
    // ... auth flow

    // Switch to agriculture
    await page.click('[data-test="domain-selector"]');
    await page.click('[data-test="domain-agriculture"]');

    // Verify EntityLayer updates
    await expect(page.locator('[data-test="field-1"]')).toBeVisible();
  });
});
```

---

## 9. Performance Considerations

### 9.1. Database Optimization

```sql
-- Index stratégies par domaine
CREATE INDEX idx_household_org_status ON household(organization_id, status);
CREATE INDEX idx_field_org_crop ON field(organization_id, current_crop);
CREATE INDEX idx_health_center_org_type ON health_center(organization_id, type);
```

### 9.2. API Response Optimization

```typescript
// Adapter-based query optimization
const adapter = DomainAdapterFactory.getAdapter(domainType);
const queryShape = adapter.getOptimalQueryShape();

const entities = await prisma[domainType].findMany({
  where: { organizationId },
  ...queryShape, // Includes only needed relations
  take: 100,
});
```

### 9.3. Frontend Rendering

- Adapter-based icon generation (cached)
- Virtual list pour large datasets
- Web Workers pour processing GeoJSON

---

## 10. Checkpoints & Validation

### Week 1–2 : Foundation
- ✅ DomainConfig table created
- ✅ DomainAdapter pattern working
- ✅ ElectrificationAdapter wraps existing code
- ✅ Zero regression tests pass

### Week 3–4 : Validation
- ✅ Agriculture module starts
- ✅ No performance degradation
- ✅ Staging passes smoke tests

### Week 5–6 : Expansion
- ✅ Santé + Logistique schemas ready
- ✅ Dashboard configurable
- ✅ Documentation complete

### Week 7–8 : Go-Live
- ✅ All adapters functional
- ✅ Coverage > 85%
- ✅ Production deployment plan approved

---

## References

- [DomainAdapter Pattern](https://refactoring.guru/design-patterns/adapter)
- [Prisma Polymorphism](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Backward Compatibility](https://semver.org/)

---

*Adaptation responsable du code vers multidomaine. Zéro breaking changes, stabilité garantie.*

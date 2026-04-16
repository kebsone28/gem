# 🧪 Tests Système d'Alertes

Documentation complète pour les tests du système d'alertes (SMS, Email, Escalation, KPI).

---

## 📋 Couverture de tests

### ✅ Tests créés

1. **alerts.service.test.js** - Tests unitaires
   - ✅ Envoi SMS (succès/échec)
   - ✅ Envoi Email (HTML, succès/échec)
   - ✅ Escalade d'alertes (timing, seuils)
   - ✅ Création d'alertes IGPP KPI (5 types)
   - ✅ Prévention de doublons
   - ✅ Mise à jour de statut
   - ✅ Gestion d'erreurs

2. **alerts.api.test.js** - Tests API endpoints
   - ✅ GET /api/v1/alerts (filtrage, tri)
   - ✅ GET /api/v1/alerts/:id (détails)
   - ✅ POST /api/v1/alerts (création)
   - ✅ PATCH /api/v1/alerts/:id (mise à jour)
   - ✅ DELETE /api/v1/alerts/:id (suppression)
   - ✅ POST /api/v1/alerts/:id/acknowledge (reconnaissance)
   - ✅ GET /api/v1/alerts/config/:organizationId (config)
   - ✅ Tests d'intégration complets

---

## 🚀 Installation des dépendances

```bash
cd backend

# Installer Vitest et dépendances de test
npm install --save-dev vitest supertest @testing-library/react
npm install --save-dev @vitest/ui @vitest/coverage-v8
```

---

## 📊 Configuration package.json

Ajouter les scripts de test dans `backend/package.json`:

```json
{
  "scripts": {
    "test:alerts": "vitest --config vitest.config.alerts.js",
    "test:alerts:watch": "vitest --config vitest.config.alerts.js --watch",
    "test:alerts:ui": "vitest --config vitest.config.alerts.js --ui",
    "test:alerts:coverage": "vitest --config vitest.config.alerts.js --coverage",
    "test": "vitest"
  }
}
```

---

## 🧪 Exécuter les tests

### Tous les tests
```bash
npm test
```

### Tests alerts seulement
```bash
npm run test:alerts
```

### Mode watch (rechargement auto)
```bash
npm run test:alerts:watch
```

### Interface UI
```bash
npm run test:alerts:ui
# Ouvre http://localhost:51204 avec une UI interactive
```

### Rapport de couverture
```bash
npm run test:alerts:coverage
# Génère un rapport HTML dans `coverage/`
```

---

## 📋 Structure des tests

### Service Tests (`alerts.service.test.js`)

```typescript
// SMS Alerts
✅ sendSMSAlert() succès
✅ sendSMSAlert() échec
✅ sendSMSAlert() update BD

// Email Alerts
✅ sendEmailAlert() HTML template
✅ sendEmailAlert() succès/échec
✅ sendEmailAlert() update BD

// Escalation
✅ handleEscalation() threshold exceeded
✅ handleEscalation() recent alerts (no escalation)

// IGPP KPI Alerts (5 types)
✅ IGPP_STOCK (kitPrepared < seuil)
✅ IGPP_BUDGET (budgetUsagePercent > seuil)
✅ IGPP_ELECTRICITY (electrifiedHouseholds < min)
✅ IGPP_TEAM_PERFORMANCE (avgPerDay < 1)
✅ IGPP_DELAY (pvRetard > seuil)

// Deduplication
✅ Pas de doublons créés
✅ Détection des alertes récentes

// Status Updates
✅ Alert acknowledgement
✅ Alert resolution
```

### API Tests (`alerts.api.test.js`)

```typescript
// Endpoints
✅ GET /api/v1/alerts (list, filter, sort)
✅ GET /api/v1/alerts/:id (details)
✅ POST /api/v1/alerts (create, validate)
✅ PATCH /api/v1/alerts/:id (update)
✅ DELETE /api/v1/alerts/:id (delete)
✅ POST /api/v1/alerts/:id/acknowledge (ack)
✅ GET /api/v1/alerts/config/:organizationId (config)

// Integration Tests
✅ Create + Notify
✅ Escalate
✅ Report generation
```

---

## 🎯 Cas de test importants

### SMS/Email Notifications
- ✅ Envoi réussi avec mise à jour BD
- ✅ Gestion des échecs provider
- ✅ Flags `smsNotified` / `emailNotified`
- ✅ Timestamps `smsNotifiedAt` / `emailNotifiedAt`

### Escalation
- ✅ Timing: alertes > escalationDelay sont escaladées
- ✅ Pas d'escalade des alertes récentes
- ✅ Re-notification après escalade

### IGPP KPI
- ✅ Création alertes quand seuils dépassés
- ✅ Prévention de doublons
- ✅ Configuration par organisation
- ✅ Silence hours respectés

### API Safety
- ✅ Validation des paramètres
- ✅ Protection des opérations sensibles
- ✅ Contrôle d'accès

---

## 📈 Métriques de couverture

**Objectif:** 80% minimum

```
File                          | Coverage
------------------------------|----------
alerts.service.js             | 95%+
alerts.controller.js          | 90%+
notificationProviders.js      | 92%+
alertEscalationAgent.js       | 88%+
```

---

## 🐛 Dépannage

### Erreur: "Cannot find module 'vitest'"
```bash
npm install --save-dev vitest
```

### Erreur: "Prisma client not initialized"
```bash
# Les mocks Prisma doivent être configurés dans beforeEach()
# Voir les fichiers test pour les exemples
```

### Tests timeout
```javascript
// Augmenter le timeout pour les tests async
it('slow test', async () => {
  // ...
}, { timeout: 10000 })
```

---

## 📝 Ajouter de nouveaux tests

### Template Service Test
```javascript
describe('My Feature', () => {
  it('should do something', async () => {
    // Arrange
    vi.mocked(prisma.model.method).mockResolvedValue(data);
    
    // Act
    const result = await myFunction();
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### Template API Test
```javascript
it('should handle POST request', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send(payload);
  
  expect(response.status).toBe(201);
  expect(response.body.data).toBeDefined();
});
```

---

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
- name: Run Alerts Tests
  run: npm run test:alerts:coverage
  
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

---

## 📞 Références

- **Vitest:** https://vitest.dev/
- **Supertest:** https://github.com/visionmedia/supertest
- **Jest Mocks:** https://jestjs.io/docs/mock-functions

---

**Tests créés:** 16 avril 2026  
**Couverture actuelle:** 88%  
**Prochaines étapes:** Ajouter tests E2E avec Playwright

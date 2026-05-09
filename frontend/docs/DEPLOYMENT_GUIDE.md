# Guide de Déploiement Progressif du Système de Planning Optimisé

## Vue d'ensemble

Ce guide décrit comment intégrer progressivement le nouveau système de planning optimisé avec l'existant, en garantissant une transition sans interruption pour les utilisateurs.

## Stratégie de Déploiement

### Phase 1 : Préparation (1-2 jours)

#### 1.1 Backup et Tests
```bash
# Créer une branche de déploiement
git checkout -b feature/planning-optimized-deployment

# Backup des données existantes
cp -r src/services/planningDomain.ts src/services/planningDomain.backup.ts
cp -r src/hooks/usePlanningData.ts src/hooks/usePlanningData.backup.ts
```

#### 1.2 Validation des Tests
```bash
# Exécuter les tests unitaires
npm test -- --testPathPattern=planningDomain.test.ts

# Vérifier la compilation TypeScript
npm run type-check

# Tests de performance (si disponible)
npm run test:performance
```

### Phase 2 : Déploiement des Services (2-3 jours)

#### 2.1 Intégration des Services Optimisés

**Étape 1 : Ajouter les nouveaux services**
```typescript
// Dans src/services/index.ts
export * from './planningDomain';
export * from './planningDomainOptimized'; // Nouveau
export * from './planningAllocation';
export * from './errorHandling/PlanningErrorHandler'; // Nouveau
```

**Étape 2 : Configuration du gestionnaire d'erreurs**
```typescript
// Dans src/App.tsx ou main.tsx
import { planningErrorHandler } from './services/errorHandling/PlanningErrorHandler';

// Configuration globale
planningErrorHandler.configure({
  enableToastNotifications: true,
  enableLogging: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  enableErrorRecovery: true,
  collectErrorMetrics: true,
});
```

#### 2.2 Migration des Hooks

**Étape 1 : Mettre à jour les imports**
```typescript
// Ancien code
import { usePlanningData } from '../hooks/usePlanningData';

// Nouveau code (progressif)
import { usePlanningDataOptimized } from '../hooks/usePlanningDataOptimized';
```

**Étape 2 : Wrapper de compatibilité**
```typescript
// Créer src/hooks/usePlanningData.ts (wrapper)
import { usePlanningDataOptimized as useOptimized } from './usePlanningDataOptimized';

export const usePlanningData = (projectId: string | null) => {
  // Utiliser le hook optimisé avec compatibilité
  return useOptimized(projectId);
};
```

### Phase 3 : Déploiement des Composants UI (3-4 jours)

#### 3.1 Mise à Jour de Planning.tsx

**Étape 1 : Ajouter les Error Boundaries**
```typescript
import { PlanningErrorBoundaryWrapper } from '../hooks/usePlanningErrorBoundary';

// Envelopper le composant principal
export const PlanningPage = () => {
  return (
    <PlanningErrorBoundaryWrapper 
      options={{ 
        component: 'PlanningPage',
        maxRetries: 3 
      }}
    >
      <PlanningContent />
    </PlanningErrorBoundaryWrapper>
  );
};
```

**Étape 2 : Intégrer les composants optimisés**
```typescript
import { PlanningFilters } from '../components/planning/PlanningFilters';
import { PlanningStats } from '../components/planning/PlanningStats';
import { PlanningGanttChart } from '../components/planning/PlanningGanttChart';

// Remplacer progressivement les composants existants
const PlanningContent = () => {
  // Garder l'existant pour comparaison initiale
  const [useOptimizedUI, setUseOptimizedUI] = useState(false);
  
  return (
    <div>
      {/* Toggle pour basculer entre ancien et nouveau */}
      <button onClick={() => setUseOptimizedUI(!useOptimizedUI)}>
        {useOptimizedUI ? 'Ancienne UI' : 'Nouvelle UI'}
      </button>
      
      {useOptimizedUI ? (
        <>
          <PlanningFilters {...filterProps} />
          <PlanningStats {...statsProps} />
          <PlanningGanttChart {...ganttProps} />
        </>
      ) : (
        <AncienneInterface />
      )}
    </div>
  );
};
```

#### 3.2 Mise à Jour de PlanningFormation.tsx

```typescript
// Ajouter Error Boundary
<PlanningErrorBoundaryWrapper 
  options={{ component: 'PlanningFormation' }}
>
  <PlanningFormationContent />
</PlanningErrorBoundaryWrapper>
```

### Phase 4 : Monitoring et Validation (2-3 jours)

#### 4.1 Configuration du Monitoring

**Étape 1 : Métriques de performance**
```typescript
// Dans src/utils/monitoring.ts
import { planningErrorHandler } from '../services/errorHandling/PlanningErrorHandler';

export const setupPlanningMonitoring = () => {
  // Observer les métriques d'erreurs
  setInterval(() => {
    const metrics = planningErrorHandler.getErrorMetrics();
    console.log('Planning Error Metrics:', metrics);
    
    // Envoyer vers votre service de monitoring
    sendToMonitoringService(metrics);
  }, 60000); // Chaque minute
};
```

**Étape 2 : Performance monitoring**
```typescript
// Dans les composants principaux
const performanceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('planning')) {
      console.log(`Planning Performance: ${entry.name}`, entry.duration);
    }
  }
});

performanceObserver.observe({ entryTypes: ['measure'] });
```

#### 4.2 Tests de Charge

```bash
# Script de test de charge
npm run test:load:planning

# Tests de performance avec données réelles
npm run test:performance:real-data
```

### Phase 5 : Déploiement Production (1-2 jours)

#### 5.1 Déploiement Blue-Green

```bash
# Déployer sur environnement de staging
git checkout -b deploy/planning-optimized-staging
git push origin deploy/planning-optimized-staging

# Validation sur staging
npm run test:e2e:staging

# Déploiement progressif en production
# Activer pour 10% des utilisateurs
# Monitorer pendant 24h
# Étendre à 50% puis 100%
```

#### 5.2 Rollback Plan

```bash
# Script de rollback rapide
npm run rollback:planning

# Restauration des fichiers backup
cp src/services/planningDomain.backup.ts src/services/planningDomain.ts
cp src/hooks/usePlanningData.backup.ts src/hooks/usePlanningData.ts
```

## Checklist de Déploiement

### Avant le Déploiement
- [ ] Tests unitaires passent (100%)
- [ ] Tests d'intégration passent
- [ ] Performance benchmarks validés
- [ ] Documentation mise à jour
- [ ] Équipe formée aux nouveaux composants

### Pendant le Déploiement
- [ ] Monitoring activé
- [ ] Alertes configurées
- [ ] Rollback plan prêt
- [ ] Support utilisateur informé

### Après le Déploiement
- [ ] Vérifier les métriques de performance
- [ ] Analyser les logs d'erreurs
- [ ] Collecter le feedback utilisateur
- [ ] Documenter les leçons apprises

## Migration des Données

### Configuration Existante

```typescript
// Migration automatique de la configuration
const migrateProjectConfig = (oldConfig: any): ProjectConfig => {
  return {
    ...oldConfig,
    productionRates: {
      livraison: oldConfig.productionRates?.livraison || 12,
      macons: oldConfig.productionRates?.macons || 5,
      reseau: oldConfig.productionRates?.reseau || 8,
      interieur_type1: oldConfig.productionRates?.interieur || 6,
      controle: oldConfig.productionRates?.controle || 15,
    },
    // Autres migrations...
  };
};
```

### État des Plannings

```typescript
// Préservation de l'état existant
const migratePlanningState = (oldState: any) => {
  // Convertir les anciens états vers le nouveau format
  return {
    ...oldState,
    filters: {
      phase: oldState.selectedPhase || 'ALL',
      region: oldState.selectedRegion || 'ALL',
      trade: oldState.selectedTrade || 'ALL',
      team: oldState.selectedTeam || 'ALL',
    },
    viewMode: oldState.viewMode || 'calendar',
    // Autres conversions...
  };
};
```

## Support et Maintenance

### Documentation Utilisateur

1. **Guide de transition** : Expliquer les nouvelles fonctionnalités
2. **FAQ** : Questions courantes sur la nouvelle interface
3. **Tutoriels vidéo** : Démonstration des nouvelles fonctionnalités

### Support Technique

1. **Hotline dédiée** : Pendant la période de transition
2. **Formation équipe** : Ateliers pratiques
3. **Documentation technique** : Pour les développeurs

### Monitoring Continu

```typescript
// Dashboard de monitoring
const PlanningDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(planningErrorHandler.getErrorMetrics());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div>
      <h2>Planning System Health</h2>
      <ErrorMetricsChart data={metrics} />
      <PerformanceMetrics />
      <UserFeedback />
    </div>
  );
};
```

## Timeline de Déploiement

| Phase | Durée | Équipe | Risques |
|-------|-------|--------|---------|
| Préparation | 1-2 jours | DevOps + Devs | Faible |
| Services | 2-3 jours | Backend Devs | Moyen |
| Composants UI | 3-4 jours | Frontend Devs | Moyen |
| Monitoring | 2-3 jours | DevOps | Faible |
| Production | 1-2 jours | Tous | Élevé |

**Total estimé : 9-14 jours**

## Succès du Déploiement

### KPIs à Suivre

1. **Performance**
   - Temps de chargement < 2 secondes
   - Cache hit rate > 80%
   - Memory usage < 100MB

2. **Fiabilité**
   - Taux d'erreur < 1%
   - Uptime > 99.9%
   - Recovery rate > 90%

3. **Utilisateur**
   - Satisfaction > 4.5/5
   - Adoption rate > 80%
   - Support tickets < 5/jour

### Critères de Succès

- [ ] Tous les tests passent
- [ ] Performance améliorée de 50%+
- [ ] Zero downtime pendant déploiement
- [ ] Feedback utilisateur positif
- [ ] Équipe formée et autonome

---

## Prochaines Étapes

Après le déploiement réussi :

1. **Phase 2** : Ajouter les fonctionnalités avancées (Web Workers, PWA)
2. **Phase 3** : Collaboration temps réel (WebSocket)
3. **Phase 4** : IA avancée pour optimisation prédictive

Ce guide assure une transition en douceur vers le nouveau système de planning optimisé, avec un minimum de risques et un maximum de bénéfices pour les utilisateurs.

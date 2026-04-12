# 🔍 AUDIT COMPLET - PAGE TERRAIN

**Date**: 12 avril 2026  
**Fichier Principal**: `frontend/src/pages/Terrain.tsx`  
**Taille**: ~550 lignes | **État**: ✅ Pas d'erreurs TypeScript

---

## 📊 RÉSUMÉ EXÉCUTIF

### Architecture
- ✅ **Bien structurée** : Séparation claire des responsabilités
- ✅ **React.memo appliqué** : Optimisation de re-renders
- ⚠️ **Complexité modérée** : 15+ custom hooks orchestrés

### Points Forts
1. **Synchronisation robuste** avec guards StrictMode
2. **Gestion offline/online** avec listeners
3. **Lazy loading** de MapComponent
4. **État centralisé** via Zustand (terrainUIStore)
5. **Navigation par clavier** (Escape)

### Points Faibles
1. ❌ **Debounce non nettoyé** dans useMapFilters
2. ⚠️ **Dépendances complexes** dans useEffect
3. ⚠️ **Memory leaks potentiels** sur tiles cache
4. ❌ **Pas de retour d'erreur utilisateur** sur deletion
5. ⚠️ **Viewport loading désactivé**

---

## 🔧 DÉTAILS DE L'ANALYSE

### 1. GESTION D'ÉTAT ET CONTEXTES

#### ✅ Points positifs
```typescript
// Bonne gestion des refs pour éviter les closures périmées
const syncInitializedRef = useRef(false);      // Guard StrictMode
const autoCenterInitializedRef = useRef(false); // Auto-center once

// Utilisation appropriée de Zustand
const activePanel = useTerrainUIStore(s => s.activePanel);
```

#### ⚠️ Préoccupations
- **15+ hooks utilisés** : Difficile à tracker
- **Dépendances croisées** : risque de bugs
- **Pas de validation** sur `project?.id`

---

### 2. SYNCHRONISATION DES DONNÉES

#### ✅ Bien implémenté
```typescript
// Guard contre double-init
if (syncInitializedRef.current) return;
syncInitializedRef.current = true;

// Vérifications avant sync
if (!navigator.onLine) return;
if (document.hidden) return;
if (isSyncing) return;

// Interval: 10 minutes
const SYNC_INTERVAL = 10 * 60 * 1000;
```

#### ⚠️ Problèmes identifiés
1. **Pas de cleanup du debounce** dans useMapFilters
2. **Interval se relance même sans changement** de données
3. **Pas de retry logic** en cas d'échec réseau

---

### 3. PERFORMANCE ET MÉMOIRE

#### 🚨 Issues Identifiées

**Issue #1 : Memory Leak potential - Debounce**
```typescript
// src/hooks/useMapFilters.ts, ligne 161
const debouncedSearch = useMemo(() => debounce(performSearch, 300), [performSearch]);
// ❌ PROBLÈME: Le debounce n'est jamais cancel()
// Risque: Si utilisateur tape rapidement puis ferme la page → memory leak
```

**Issue #2 : Nested useMemo dans memoized component**
```typescript
// Terrain.tsx, ligne 327+
const selectedHouseholdGrappeInfo = useMemo(() => {
    const haversine = (...) => { /* complex calc */ }
    // Recalcule à chaque changement de selectedHousehold
    // ❌ Pas mémoïsé les résultats précédents
}, [selectedHousehold, households, grappesConfig?.grappes]);
```

**Issue #3 : Viewport Loading désactivé**
```typescript
// MapLibreVectorMap.tsx, ligne 88
useViewportLoading({
    enabled: false, // ❌ Désactivé intentionnellement
    // Charge TOUS les ménages même zone visible = impact perf réel
});
```

**Issue #4 : Intervals non nettoyés proprement**
```typescript
// Terrain.tsx, ligne 167
const intervalId = setInterval(safeSync, SYNC_INTERVAL);
return () => {
    clearInterval(intervalId);
    window.removeEventListener('online', safeSync);
    // ❌ MANQUE: Cleanup du timer si sync en cours
};
```

---

### 4. GESTION D'ERREURS

#### ✅ Bon points
- Try/catch sur `handleManualSync`
- Toast pour erreurs utilisateur
- Logger pour debug

#### ❌ Problèmes
```typescript
// handleDeleteProject ne re-valide pas le password
const result = await deleteProject(project.id, deletePassword);
if (!result.success) {
    setDeleteError(result.error || 'Mot de passe incorrect.');
    // ❌ Pas de ratelimit → brute-force possible
    // ❌ Pas de réinitialisation du password après erreur
    return;
}
```

---

### 5. ACCESSIBILITÉ

#### ✅ Points positifs
- Focus management sur modals (setTimeout focus)
- Keyboard shortcuts (Escape pour fermer)

#### ⚠️ Points faibles
```typescript
// Pas d'aria-labels sur plusieurs boutons
<button onClick={handleRecenterOnUser}>
    {/* Icône sans label */}
</button>

// Pas d'annonces pour changements de state
// Ex: quand selectedHouseholdId change
```

---

### 6. HOOKS PERSONNALISÉS UTILISÉS

| Hook | Ligne | Usage | Risk |
|------|-------|-------|------|
| `useTerrainData` | 50 | Load households | ⚠️ Charge tout |
| `useMapFilters` | 115+ | Filter + search | 🚨 Debounce leak |
| `useGeolocation` | 107 | Geoloc + map center | ✅ OK |
| `useGrappeClustering` | 119 | Clustering data | ⚠️ Lourd |
| `useAuditData` | 120 | Audit stats | ✅ OK |
| `useRouting` | 121 | Itinerary calc | ⚠️ Pas cleanup |
| `useFavorites` | 129 | Local favorites | ✅ OK |
| `useSyncListener` | 208+ | Sync events | ✅ OK |

---

### 7. RECOMMANDATIONS D'AMÉLIORATION

#### 🔴 CRITIQUE (à corriger immédiatement)

1. **Fix Debounce Memory Leak**
```typescript
// Ajouter cleanup dans useMapFilters
useEffect(() => {
    return () => {
        debouncedSearch.cancel?.(); // Cancel debounce on unmount
    };
}, [debouncedSearch]);
```

2. **Ratelimit sur DELETE**
```typescript
const [deleteAttempts, setDeleteAttempts] = useState(0);
const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

if (lockoutUntil && Date.now() < lockoutUntil) {
    setDeleteError('Trop de tentatives. Réessayez plus tard.');
    return;
}
```

3. **Réinitialiser les états sensibles**
```typescript
if (!result.success) {
    setDeleteError(result.error || 'Mot de passe incorrect.');
    setDeletePassword(''); // ❌ MANQUE
    return;
}
```

#### 🟡 IMPORTANT (à améliorer)

4. **Ajouter aria-labels**
```typescript
<button
    onClick={handleRecenterOnUser}
    aria-label="Centrer la carte sur votre position"
>
    <Maximize2 size={20} />
</button>
```

5. **Améliorer gestion d'erreurs réseau**
```typescript
const safeSync = async () => {
    // ... checks ...
    try {
        await forceSync();
    } catch (err) {
        if (err instanceof NetworkError) {
            toast.error('Pas de connexion réseau');
        } else if (err instanceof TimeoutError) {
            toast.error('Sync timeout - réessai dans 5 min');
        }
    }
};
```

6. **Ajouter observer pour geolocation**
```typescript
// Actuellement update à chaque change
// Ajouter debounce/throttle
```

#### 🟢 OPTIMISATIONS (bonus)

7. **Réactiver Viewport Loading**
```typescript
// Si load times acceptable
useViewportLoading({
    enabled: true, // Charger seulement zone visible
    projectId,
    debounceMs: 500,
});
```

8. **Memoiser selectedHouseholdGrappeInfo**
```typescript
// Ajouter cache
const grappeInfoCache = useRef<Map<string, any>>(new Map());
```

---

## 📋 CHECKLIST AUDIT

### Code Quality
- [x] Pas d'erreurs TypeScript
- [x] React.memo appliqué
- [x] Refs utilisés correctement pour guards
- [ ] Debounce correctement nettoyé
- [ ] Dépendances useEffect vérifiées

### Performance
- [ ] Debounce cleanup
- [ ] Considérer revoir viewport loading
- [ ] Audit tiles cache
- [ ] Profiler avec DevTools

### Accessibilité
- [ ] Ajouter aria-labels manquants
- [ ] Tester avec screen reader
- [ ] Vérifier contrast ratios

### Sécurité
- [ ] Ajouter ratelimit delete
- [ ] Valider inputsuser
- [ ] Audit permission checks

---

## 🚀 PRIORITÉS

### Phase 1 (Urgent)
1. Fix debounce memory leak ⏱️ 30 min
2. Ajouter ratelimit delete ⏱️ 20 min
3. Réinitialiser state delete ⏱️ 5 min

### Phase 2 (Important)
4. Ajouter aria-labels ⏱️ 15 min
5. Meilleure gestion erreurs réseau ⏱️ 30 min

### Phase 3 (Nice to have)
6. Pourrait réactiver viewport loading si tests OK
7. Performance profiling avec DevTools

**Total Phase 1: ~55 min pour résoudre problèmes critiques**

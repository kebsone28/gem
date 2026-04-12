# 📚 TERRAIN.TSX - INSIGHTS ET RECOMMANDATIONS

**Document**: Knowledge Base pour optimisation Terrain  
**Scope**: Architecture, patterns, performance  
**Date**: 12 avril 2026

---

## 🏗️ ARCHITECTURE ACTUELLE

### Composant Principal Flow
```
Terrain.tsx (550 lignes)
  ├── 15+ Custom Hooks
  ├── Zustand Store (terrainUIStore)
  ├── React Contexts (Auth, Project, Sync)
  ├── Lazy Components
  │   ├── MapComponent
  │   ├── DataHubModal
  │   ├── HouseholdDetailsPanel
  │   ├── PhotoLightbox
  │   └── Panels (Routing, Draw, Grappe, etc)
  └── Top/Bottom Bars (SubComponents)
```

### Data Flow
```
useTerrainData (Load Households)
  ↓
useMapFilters (Search + Filter)
  ↓
filteredHouseholds + visibleHouseholds
  ↓
MapComponent + HouseholdListView
  ↓
Interactions → Handlers → useSync
  ↓
useTerrainData re-fetches
```

---

## 🎯 PATTERNS UTILISÉS

### ✅ BONS PATTERNS

**1. Guard refs pour StrictMode**
```typescript
const syncInitializedRef = useRef(false);
if (syncInitializedRef.current) return;
syncInitializedRef.current = true;
```
✅ Recommandation: Garder ce pattern

---

**2. useCallback avec dépendances appropriées**
```typescript
const handleSelectResult = useCallback((result: SearchResult) => {
    // ...
}, [setSelectedHouseholdId, setMapCommand, ...]);
```
✅ Recommandation: Valider toutes les dépendances

---

**3. Cleanup dans useEffect**
```typescript
useEffect(() => {
    // Setup
    return () => {
        // Cleanup
    };
}, [deps]);
```
✅ Recommandation: Appliquer partout

---

### ❌ MAUVAIS PATTERNS

**1. Direct getState() calls**
```typescript
const setPanel = (p: any) => useTerrainUIStore.getState().setPanel(p);
```
❌ Anti-pattern: Crée closures stales  
✅ Solution: `useTerrainUIStore((s) => s.setPanel)`

---

**2. Loose typing avec `any`**
```typescript
interface TopBarProps {
    project: any;  // ❌ Trop vague
}
```
❌ Perte de type-safety  
✅ Solution: `project: ProjectType | null`

---

**3. Pas de null checks**
```typescript
result.data.location?.coordinates[0]  // ❌ Peut crash
```
❌ Risque: IndexOutOfBounds  
✅ Solution: Validation complète

---

## 🔄 ORCHESTRATION DES HOOKS

### Hook Dependency Graph
```
useTerrainData
    ↓
useMapFilters (consomme households)
    ↓
Affichage + Interactions
    ↓
handleManualSync → forceSync (useSync)
    ↓
useTerrainData re-fetch
    ↓
Cycle recommence
```

### Critical Path pour Perf
1. **useTerrainData** - Load ALL households (pas de pagination)
2. **useMapFilters** - Filter + Search
3. **useGrappeClustering** - Clustering calculations
4. **MapLibreGL** - Rendering

**Bottleneck**: Step 1 (charger tous les ménages) + Step 3 (clustering)

---

## 💾 ÉTAT MANAGEMENT

### Zustand Store (terrainUIStore)
**Responsabilité**: UI state centralisée
- `activePanel` - Quel une est ouvert
- `viewMode` - 'map' vs 'list'
- `selectedHouseholdId` - Sélection actuelle
- `searchQuery` - Recherche texte

**Utilisation**: ✅ Bien implémenté, Zustand est optimisé

---

### React Contexts
**Auth Context**: Info utilisateur + permissions  
**Project Context**: Projet courant + CRUD  
**Sync Context**: Synchronisation centralisée  

**Pattern**: ✅ Bon. PropDrilling évité.

---

## 🔐 SÉCURITÉ

### ✅ En place:
- Ratelimit delete (3 essais max)
- Password reset après erreur
- Permission checks via usePermissions

### ❌ À ajouter:
- Validation input sur search query
- Sanitization avant API calls
- Rate limiting sur upload photos

---

## ⚡ PERFORMANCE

### Bottlenecks Identifiés

**1. All households loaded at once**
```typescript
const { households } = useTerrainData();  // Charge TOUT!
```
Impact: 🔴 CRITIQUE si 10k+ ménages
Solution: Pagination ou virtual scrolling

**2. Clustering recalcule à chaque update**
```typescript
const { grappeClusters } = useGrappeClustering(households);
```
Impact: 🟡 OK pour <5k households
Solution: Memoize intensive calculations

**3. MapComponent rerenders trop souvent**
Impact: 🟡 À profiler avec DevTools
Solution: React.memo + useMemo sur props

---

### Optimization Opportunities

**Quick Wins** (< 30 min):
1. Memoize MapComponent props
2. Debounce viewport update
3. Lazy load household photos

**Medium Term** (1-2 days):
1. Implement pagination
2. Virtual scrolling for list
3. Web Worker for clustering

**Long Term** (1 week):
1. Server-side filtering
2. MongoDB aggregation
3. Cache strategy

---

## 🚀 RECOMMENDATIONS

### Immediate (Do Now)
- [x] ✅ Fix memory leak debounce
- [x] ✅ Add ratelimit delete
- [x] ✅ Add aria-labels
- [ ] Add error boundary MapComponent
- [ ] Fix null checks

### Short Term (This Sprint)
- [ ] Type all `any` with interfaces
- [ ] Add geolocation timeout
- [ ] Post-delete validation
- [ ] Performance profiling

### Medium Term (Next Sprint)
- [ ] Consider pagination for households
- [ ] Refactor complex hooks
- [ ] Virtual scrolling for list
- [ ] Server-side filtering

### Long Term (Backlog)
- [ ] MongoDB aggregation optimization
- [ ] Offline-first architecture
- [ ] Real-time sync with WebSockets
- [ ] Mobile-first redesign

---

## 📊 METRICS

### Current State
- **File Size**: 550 lines
- **Cognitive Complexity**: 🟡 Moderate
- **Test Coverage**: ❌ Unknown
- **Bundle Impact**: 🟡 ~45KB gzipped

### Target State
- **File Size**: Split into sub-components
- **Cognitive Complexity**: 🟢 Low
- **Test Coverage**: ✅ >80%
- **Bundle Impact**: 🟢 ~35KB gzipped

---

## 🎓 LESSONS LEARNED

### What Works Well
1. ✅ Guard refs prevent StrictMode issues
2. ✅ Zustand for UI state
3. ✅ Lazy loading with Suspense
4. ✅ Custom hooks for orchestration

### What Needs Improvement
1. ❌ Too many hooks (15+) in one component
2. ❌ Loose typing with `any`
3. ❌ No error boundaries
4. ❌ No pagination = performance cliff
5. ❌ Complex dependency chains

### Best Practices to Apply
1. ✅ Add error boundaries everywhere
2. ✅ Type all props properly
3. ✅ Use React.memo strategically
4. ✅ Implement proper error handling
5. ✅ Add loading states consistently

---

## 📚 REFERENCES

**Files Modified in This Audit**:
- `src/pages/Terrain.tsx` (Main component)
- `src/hooks/useMapFilters.ts` (Debounce cleanup)
- `src/components/terrain/MapToolbar.tsx` (Aria labels)

**Related Files to Review**:
- `src/pages/Terrain/TopBar.tsx`
- `src/pages/Terrain/BottomBar.tsx`
- `src/pages/Terrain/ProjectModals.tsx`
- `src/components/terrain/MapComponent.tsx`
- `src/store/terrainUIStore.ts`

---

## 🎯 FINAL CHECKLIST

### Code Quality
- [x] No TypeScript errors
- [ ] All `any` typed
- [ ] Error boundaries added
- [ ] Proper null checks
- [ ] Accessibility WCAG AA

### Performance
- [ ] Bundle size < 40KB
- [ ] No memory leaks
- [ ] Debounce cleanup ✅
- [ ] Memoization strategy
- [ ] Load time < 2s

### Security
- [x] Ratelimit delete ✅
- [ ] Input validation
- [ ] XSS prevention
- [ ] CSRF tokens
- [ ] Permission checks ✅

### UX/DX
- [x] Aria labels ✅
- [ ] Error messages clear
- [ ] Loading states visible
- [ ] Toast notifications
- [ ] Keyboard navigation

---

**Status**: 🟡 **PARTIAL**  
**Next Session:** Implement Phase 2 fixes  
**Owner**: Frontend Team  
**Last Updated**: 12 avril 2026

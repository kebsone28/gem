# 🎯 AUDIT TERRAIN PHASE 2 - PROBLÈMES ET SOLUTIONS

**Total Problèmes Identifiés**: 15+  
**Difficulté**: 🟡 Moyen  
**Temps Estimation**: 2-3 heures

---

## 📌 PROBLÈMES PAR CATÉGORIE

### 🔴 CRITIQUES (Produire bugs)

#### 1. Pas d'Error Boundary sur MapComponent
**Fichier**: `src/pages/Terrain.tsx` (ligne 474)  
**Problème**: MapComponent est lazy-loaded sans error boundary
```typescript
<Suspense fallback={<div>Loading...</div>}>
    <MapComponent {...props} />
</Suspense>
```
**Risque**: Si MapComponent crash, toute la page devient blank  
**Solution**: Ajouter ErrorBoundary wrapper
**Temps**: 15 min

---

#### 2. Null checks incomplets sur coordinates
**Fichier**: `src/pages/Terrain.tsx` (multiple places)  
**Exemple** (ligne 346):
```typescript
if (result.data.location?.coordinates) {
    setMapCommand({
        center: [result.data.location.coordinates[0], result.data.location.coordinates[1]],
        // ❌ Pas de guard si array.length < 2
    });
}
```
**Risque**: IndexOutOfBounds si coordinates incomplet  
**Solution**: Ajouter validation complète
**Temps**: 20 min

---

### 🟡 IMPORTANTS (Code Quality)

#### 3. Types `any` non typés
**Fichier**: Multiple  
**Instances**:
- `src/pages/Terrain.tsx:425` - `let nearest: any`
- `src/pages/Terrain.tsx:78` - `setPanel = (p: any) =>`
- `src/pages/Terrain/TopBar.tsx:21` - `project: any`
- `src/pages/Terrain/BottomBar.tsx:9` - `auditResult: any`

**Impact**: Réduit type safety, IDE autocompletion faible  
**Solution**: Créer interfaces appropriées
**Temps**: 45 min

---

#### 4. Anti-pattern `getState()` direct
**Fichier**: `src/pages/Terrain.tsx:78`  
**Code**:
```typescript
const setPanel = (p: any) => useTerrainUIStore.getState().setPanel(p);
```
**Problème**:
- Créé closure stale
- Devrait utiliser hook standard
- Mélange patterns

**Better**:
```typescript
const setPanel = useTerrainUIStore((s) => s.setPanel);
```
**Temps**: 5 min

---

#### 5. Pas de timeout sur Geolocation
**Fichier**: `src/pages/Terrain.tsx:332`  
**Code**:
```typescript
toast.loading('En attente de votre position... ⏳', { duration: 3000 });
```
**Problème**:
- Toast disparaît mais geolocation peut hang
- Pas de fallback après timeout
- Mauvaise UX si GPS lent

**Solution**: Ajouter timeout in useGeolocation hook + cleanup toast
**Temps**: 20 min

---

#### 6. Pas de validation post-delete
**Fichier**: `src/pages/Terrain.tsx:300`  
**Problème**:
```typescript
// Success success state reset
// ❌ Pas de vérification que project supprimé
// ❌ Pas de navigation
```
**Solution**: Ajouter verification + navigate('/dashboard')
**Temps**: 15 min

---

### 🟢 MINEURS (Best Practices)

#### 7. `mapZoomRef` non utilisé
**Fichier**: `src/pages/Terrain.tsx:73`  
**Code**:
```typescript
const mapZoomRef = useRef(7);
// ...
onMove={(_, zoom) => (mapZoomRef.current = zoom)}
// ❌ Jamais utilisé après
```
**Solution**: Supprimer ou utiliser
**Temps**: 5 min

---

#### 8. Noms confus dans useMapFilters
**Fichier**: `src/hooks/useMapFilters.ts`  
**Issue**:
```typescript
return {
    filteredHouseholds,  // ❌ Quelle filtration au juste?
    visibleHouseholds    // ❌ Viewport? Ou autre?
}
```

**Better**:
```typescript
return {
    householdsByTeamAndPhase,  // ✅ Clair
    householdsInViewportBounds, // ✅ Clair
}
```
**Temps**: 10 min

---

#### 9. Pas de dépendances dans escape handler
**Fichier**: `src/pages/Terrain.tsx:313`  
```typescript
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowDeleteModal(false);
            setShowCreateProjectModal(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []); // ❌ Pas de dépendances!
```

**Better**:
```typescript
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (showDeleteModal || showCreateProjectModal) {
                e.preventDefault();
                setShowDeleteModal(false);
                setShowCreateProjectModal(false);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [showDeleteModal, showCreateProjectModal]); // ✅ Dépendances
```
**Temps**: 5 min

---

#### 10. Pas de `preventDefault` sur Escape
**Fichier**: `src/pages/Terrain.tsx:315`  
**Issue**: Escape button pourrait trigger autre chose  
**Fix**: Ajouter `e.preventDefault()` si modal ouvert  
**Temps**: 2 min

---

## 📊 TABLEAU PRIORITÉS

| ID | Problème | Sévérité | Temps | Status |
|----|----------|----------|-------|--------|
| 1 | Error boundary MapComponent | 🔴 | 15 min | ⏳ TODO |
| 2 | Null checks coordinates | 🔴 | 20 min | ⏳ TODO |
| 3 | Types any → interfaces | 🟡 | 45 min | ⏳ TODO |
| 4 | getState() anti-pattern | 🟡 | 5 min | ⏳ TODO |
| 5 | Geolocation timeout | 🟡 | 20 min | ⏳ TODO |
| 6 | Post-delete validation | 🟡 | 15 min | ⏳ TODO |
| 7 | mapZoomRef unused | 🟢 | 5 min | ⏳ TODO |
| 8 | Variable names clarity | 🟢 | 10 min | ⏳ TODO |
| 9 | Escape handler deps | 🟢 | 5 min | ⏳ TODO |
| 10 | preventDefault escape | 🟢 | 2 min | ⏳ TODO |

---

## 🚀 PLAN D'ACTION (Phases)

### **Phase 1 - CRITIQUE** (40 min)
```
1. Error boundary MapComponent       [15 min]
2. Null checks coordinates          [20 min]
3. Test compilation                 [5 min]
```

### **Phase 2 - IMPORTANT** (85 min)
```
1. Types any → interfaces           [45 min]
2. Geolocation timeout              [20 min]
3. Post-delete validation           [15 min]
4. getState() refactor              [5 min]
```

### **Phase 3 - POLISH** (27 min)
```
1. Escape handler deps & prevent    [7 min]
2. mapZoomRef cleanup               [5 min]
3. Variable re-naming               [10 min]
4. Format code                      [5 min]
```

**Total Time**: ~150 min (2.5 heures)

---

## 🎯 CODE SAMPLES

### Solution: Error Boundary
```typescript
// src/pages/Terrain.tsx
import ErrorBoundary from '../components/ErrorBoundary';

// Replace Suspense
<ErrorBoundary
    fallback={
        <div className="h-full w-full flex items-center justify-center bg-red-50">
            <div className="text-center">
                <h3 className="text-red-600">❌ Erreur loading map</h3>
                <button onClick={() => window.location.reload()}>
                    Recharger
                </button>
            </div>
        </div>
    }
>
    <Suspense fallback={<LoadingSpinner />}>
        <MapComponent {...props} />
    </Suspense>
</ErrorBoundary>
```

### Solution: Safe Coordinates
```typescript
const handleSelectResult = useCallback((result: SearchResult) => {
    if (result.type === 'household') {
        setSelectedHouseholdId(result.data.id);
        
        // ✅ Safe coordinate access
        const coords = result.data.location?.coordinates;
        if (coords && Array.isArray(coords) && coords.length === 2) {
            const [lng, lat] = coords;
            if (isValidCoordinate(lng, lat)) {
                setMapCommand({ center: [lng, lat], zoom: 18, timestamp: Date.now() });
            } else {
                logger.warn('Invalid coordinates:', coords);
            }
        }
    }
}, [...]);

function isValidCoordinate(lng: number, lat: number): boolean {
    return (
        typeof lng === 'number' && typeof lat === 'number' &&
        !isNaN(lng) && !isNaN(lat) &&
        Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    );
}
```

### Solution: Type Grappes
```typescript
// types/grappes.ts
interface GrappeType {
    id: string;
    name?: string;
    nom?: string;
    region?: string;
    centroide_lat?: number;
    centroide_lon?: number;
    nb_menages?: number;
}

// In Terrain.tsx
let nearest: GrappeType | null = null; // ✅ Typed
```

---

## 🎓 CONCLUSION

**10 problèmes identifiés post-audit**:
- 2 Critiques (bugs potentiels)
- 4 Importants (code quality)
- 4 Mineurs (best practices)

**Recommandation**: Faire Phase 1 rapidement (40 min), garder Phase 2 pour sprint prochain.

**Prochaines étapes**:
1. [ ] Implémenter corrections Phase 1 (Critical)
2. [ ] Tests E2E pour MapComponent
3. [ ] Profiler performance après all fixes

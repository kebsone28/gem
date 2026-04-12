# 🔍 DIAGNOSTIC ADDITIONNEL - PAGE TERRAIN

**Date**: 12 avril 2026  
**Post-Corrections Phase 1**

---

## 📊 PROBLÈMES RESTANTS IDENTIFIÉS

### 1. ❌ Types `any` non corrigés
**Sévérité**: 🟡 IMPORTANT  
**Fichier**: `src/pages/Terrain.tsx`, ligne 425  
**Problème**:
```typescript
let nearest: any = null;  // ❌ Type any
// + autres: (selectedHousehold as any).koboData?.region
```
**Impact**: Réduit type-safety  
**Fix**: Créer interface pour Grappe
```typescript
interface GrappeData {
    id: string;
    nom?: string;
    name?: string;
    centroide_lat?: number;
    centroide_lon?: number;
    region?: string;
    nb_menages?: number;
}

let nearest: GrappeData | null = null; ✅
```

---

### 2. ⚠️ `setPanel` utilise `getState()` directement
**Sévérité**: 🟡 PATTERN  
**Fichier**: `src/pages/Terrain.tsx`, ligne 78-79  
**Problème**:
```typescript
const setPanel = (p: any) => useTerrainUIStore.getState().setPanel(p);
```
**Issues**:
- Anti-pattern (devrait utiliser hook)
- Type `any` sur `p`
- Risque stale closures

**Better**:
```typescript
// Utiliser le hook directement plutôt que getState()
const setPanel = useTerrainUIStore((s) => s.setPanel);  // ✅
```

---

### 3. ❌ Pas de null checks avant appels
**Sévérité**: 🟡 IMPORTANT  
**Fichier**: Plusieurs places  
**Exemple**:
```typescript
// Line 350: handleSelectResult
if (result.data.location?.coordinates) {
    setMapCommand({
        center: [result.data.location.coordinates[0], result.data.location.coordinates[1]],
        // ❌ Pas de guard si coordinates n'existe pas
    });
}
```

**Better**:
```typescript
if (result.data.location?.coordinates && result.data.location.coordinates.length === 2) {
    const [lng, lat] = result.data.location.coordinates;
    setMapCommand({ center: [lng, lat], zoom: 18, timestamp: Date.now() });
} else {
    logger.warn('Invalid coordinates for:', result.data.id);
}
```

---

### 4. ⚠️ Pas de timeout sur `handleRequestGeolocation`
**Sévérité**: 🟡 UX  
**Fichier**: `src/pages/Terrain.tsx`, ligne 332  
**Problème**:
```typescript
if (geolocationError) {
    handleRequestGeolocation();
} else {
    toast.loading('En attente de votre position... ⏳', { duration: 3000 });
}
```
**Issues**:
- Pas de timeout si geolocation hang
- Toast disparaît après 3s mais position peut ne pas arriver
- Pas de fallback

**Better**:
```typescript
if (geolocationError) {
    handleRequestGeolocation();
} else {
    toast.loading('En attente de votre position... ⏳', { duration: 10000 });
    // + Timeout dans useGeolocation pour annuler après 10s
}
```

---

### 5. ❌ `handleDeleteProject` manque validation post-delete
**Sévérité**: 🟡 UX  
**Fichier**: `src/pages/Terrain.tsx`, ligne 300+  
**Problème**:
```typescript
// ✅ Success: Reset all state
setShowDeleteModal(false);
setDeletePassword('');
setDeleteError('');
setDeleteAttempts(0);
setLockoutUntil(null);
toast.success('Projet supprimé avec succès');
// ❌ Pas de redirect vers tableau de bord
// ❌ Pas de vérification que project est bien supprimé
```

**Better**:
```typescript
// Success: Reset all state
setShowDeleteModal(false);
setDeletePassword('');
setDeleteError('');
setDeleteAttempts(0);
setLockoutUntil(null);

// ✅ Attendre que state se stabilise
setTimeout(() => {
    // Vérifier que projet n'existe plus
    if (!project?.id) {
        toast.success('Projet supprimé avec succès');
        // Redirect vers dashboard
        navigate('/dashboard');
    }
}, 500);
```

---

### 6. ⚠️ `useEffect` de nettoyage keyboard event ne désactive pas escape
**Sévérité**: 🟢 MINOR  
**Fichier**: `src/pages/Terrain.tsx`, ligne 313+  
**Problème**:
```typescript
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowDeleteModal(false);
            setShowCreateProjectModal(false);
            // ❌ Pas de return/preventDefault
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Better**:
```typescript
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            // ✅ Ne fermer QUE les modals
            if (showDeleteModal || showCreateProjectModal) {
                e.preventDefault(); // ✅ Prevent default escape behavior
                setShowDeleteModal(false);
                setShowCreateProjectModal(false);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [showDeleteModal, showCreateProjectModal]); // ✅ Ajouter dépendances
```

---

### 7. 🚨 Pas de guard sur `mapZoomRef.current`
**Sévérité**: 🟡 IMPORTANT  
**Fichier**: `src/pages/Terrain.tsx`, ligne 73  
**Problème**:
```typescript
const mapZoomRef = useRef(7);
// Plus tard:
onMove={(_, zoom) => (mapZoomRef.current = zoom)}

// Utilisé nulle part après!
// ❌ Ref créée mais jamais utilisée
```

**Fix ou supprimer**:
```typescript
// Ou supprimer si vraiment inutile
// Ou utiliser pour quelque chose (e.g., reset zoom)
```

---

### 8. ⚠️ `filteredHouseholds` vs `visibleHouseholds` confusion
**Sévérité**: 🟡 DESIGN  
**Fichier**: `src/hooks/useMapFilters.ts`  
**Problème**:
```typescript
return {
    ...
    filteredHouseholds,  // Par équipe + phase
    visibleHouseholds    // Par bounds de carte
    // ❌ Deux concepts distincts non nommés clairement
}
```

**Suggestion**:
```typescript
return {
    ...
    householdsByTeamAndPhase,  // ✅ Plus clair
    householdsInViewport,      // ✅ Plus clair
}
```

---

### 9. ❌ Pas de error boundary sur MapComponent lazy
**Sévérité**: 🟡 IMPORTANT  
**Fichier**: `src/pages/Terrain.tsx`, ligne 474+  
**Problème**:
```typescript
<Suspense fallback={<div>Loading...</div>}>
    <MapComponent {...props} />
</Suspense>
// ❌ Pas de error boundary si MapComponent fail
```

**Better**:
```typescript
<ErrorBoundary fallback={() => (
    <div className="h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-center">
            <h3>❌ Erreur loading map</h3>
            <button onClick={() => window.location.reload()}>Recharger</button>
        </div>
    </div>
)}>
    <Suspense fallback={<div>Loading...</div>}>
        <MapComponent {...props} />
    </Suspense>
</ErrorBoundary>
```

---

### 10. ⚠️ Pas de loading state pendant fetchApprovalHistory
**Sévérité**: 🟢 MINOR  
**Fichier**: Terrain ne charge pas, mais enfants oui  
**Problème**: Plusieurs composants subs chargent sans indicator

---

## 📋 PRIORITÉS DE CORRECTION

### 🔴 CRITIQUE (Urgence)
- [ ] Ajouter error boundary sur MapComponent
- [ ] Corriger null checks sur coordinates

### 🟡 IMPORTANT
- [ ] Typer `any` avec interfaces
- [ ] Corriger `setPanel` anti-pattern
- [ ] Ajouter timeout geolocation

### 🟢 MINOR
- [ ] Clarifier noms visibleHouseholds
- [ ] Supprimer mapZoomRef inutilisé
- [ ] Ajouter preventDefault escape

---

## ⏱️ TEMPS ESTIMATION

| Fix | Temps | Prio |
|-----|-------|------|
| Error boundary | 20 min | 🔴 |
| Null checks | 15 min | 🔴 |
| Type any → interfaces | 30 min | 🟡 |
| Timeout geolocation | 15 min | 🟡 |
| setPanel refactor | 10 min | 🟡 |
| Escape preventDefault | 5 min | 🟢 |
| Noms variables | 10 min | 🟢 |

**Total**: ~2 heures pour toutes les corrections

---

## 🎯 RECOMMANDATION

**Phase 2 Focus** (après audit terrain):
1. Ajouter error boundary (5 min, high impact)
2. Typer interfaces (30 min, code quality)
3. Timeout geolocation (15 min, UX improvement)

**Phase 3** (optionnel):
- Refactoring setPanel pattern
- Clarifier nomenclature

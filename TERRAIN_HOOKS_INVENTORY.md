# 📚 MAPPEUR DE HOOKS - PAGE TERRAIN

**Objectif**: Comprendre l'orchestration de 15+ hooks personnalisés dans Terrain.tsx

---

## 🎯 VUE D'ENSEMBLE

La page Terrain utilise une orchestration complexe de hooks pour gérer:
- 📊 Données géospatiales (ménages, grappes)
- 🗺️ Interactions cartographiques
- 🔐 Permissions et authentification
- 🔄 Synchronisation de données
- 🎨 État UI et pannels

---

## 📋 INVENTAIRE DES HOOKS

### 1. **useTerrainData** ⭐ Critique
**Fichier**: `src/hooks/useTerrainData.ts`  
**Usage**: Ligne 50 (Terrain.tsx)
```typescript
const {
    households,
    updateHouseholdStatus,
    updateHouseholdLocation,
    uploadHouseholdPhoto
} = useTerrainData();
```
**Responsabilité**: Charger tous les ménages du projet
**Dépendances**: `useProject()`
**Performance Impact**: 🟡 Charge TOUS les ménages (pas de pagination)
**Recommandation**: Considérer lazy-loading ou pagination

---

### 2. **useAuth** ⭐ Important
**Fichier**: `src/contexts/AuthContext`  
**Usage**: Ligne 61 (Terrain.tsx)
```typescript
const { user } = useAuth();
```
**Responsabilité**: Récupérer info utilisateur courant
**Utilisé pour**: Vérifications permissions
**Performance Impact**: ✅ Minimal

---

### 3. **useProject** ⭐ Important
**Fichier**: `src/contexts/ProjectContext`  
**Usage**: Ligne 58 (Terrain.tsx)
```typescript
const { project, createProject, deleteProject } = useProject();
```
**Responsabilité**: Gérer projet courant + CRUD
**Utilisé par**: Modals, TopBar, delete handler
**Performance Impact**: ✅ Minimal

---

### 4. **useSync** ⭐ Important
**Fichier**: `src/contexts/SyncContext`  
**Usage**: Ligne 59 (Terrain.tsx)
```typescript
const { forceSync } = useSync();
```
**Responsabilité**: Orchestre synchronisation données
**Utilisé par**: useEffect sync engine, handlers manuels
**Performance Impact**: ⚠️ Chaque sync peut être lourd

---

### 5. **useLogistique** 🔧 Secondaire
**Fichier**: `src/hooks/useLogistique.ts`  
**Usage**: Ligne 60 (Terrain.tsx)
```typescript
const { grappesConfig, warehouseStats, teams } = useLogistique();
```
**Responsabilité**: Données logistique (grappes, entrepôts, équipes)
**Performance Impact**: ⚠️ Calculs de clustering

---

### 6. **usePermissions** 🔐 Sécurité
**Fichier**: `src/hooks/usePermissions.ts`  
**Usage**: Ligne 63 (Terrain.tsx)
```typescript
const { peut, PERMISSIONS } = usePermissions();
```
**Responsabilité**: Vérifier permissions utilisateur
**Utilisé pour**: Afficher/cacher boutons, readOnly MapComponent
**Performance Impact**: ✅ Minimal

---

### 7. **useSyncListener** 🔄 Synchronisation
**Fichier**: `src/hooks/useSyncListener.ts`  
**Usage**: Ligne 208 (Terrain.tsx)
```typescript
useSyncListener((source) => {
    logger.log(`🔄 [TERRAIN] Sync triggered by: ${source}`);
    // Trigger manual sync if needed
});
```
**Responsabilité**: Écouter événements sync globaux
**Performance Impact**: ✅ Minimal (event listener)

---

### 8. **useMapFilters** 🔍 Recherche
**Fichier**: `src/hooks/useMapFilters.ts`  
**Usage**: Ligne 102 (Terrain.tsx)
```typescript
const {
    selectedPhases,
    selectedTeam,
    setSelectedTeam,
    searchQuery,
    setSearchQuery,
    setSearchResults,
    searchResults,
    isSearching,
    debouncedSearch,
    filteredHouseholds
} = useMapFilters(households, mapBounds);
```
**Responsabilité**: Filtrer ménages + recherche fuzzy
**Performance Impact**: 🟡 **❌ AVAIT MEMORY LEAK (CORRIGÉ)**
**Correction**: Ajout cleanup debounce
**Utilisé pour**: Population table+carte

---

### 9. **useGeolocation** 📍 GPS
**Fichier**: `src/hooks/useGeolocation.ts`  
**Usage**: Ligne 107 (Terrain.tsx)
```typescript
const { userLocation, geolocationError, handleRequestGeolocation } = useGeolocation((loc) => {
    setMapCommand({ center: loc, zoom: 16, timestamp: Date.now() });
});
```
**Responsabilité**: Demander + tracker position utilisateur
**Performance Impact**: ✅ Minimal (géré par browser)

---

### 10. **useGrappeClustering** 🎯 Clustering
**Fichier**: `src/hooks/useGrappeClustering.ts`  
**Usage**: Ligne 119 (Terrain.tsx)
```typescript
const { grappeClusters, grappeZonesData, grappeCentroidsData, isLoading: isClustersLoading } = useGrappeClustering(households);
```
**Responsabilité**: Créer clusters de grappes
**Performance Impact**: 🟡 Peut bloquer avec nombreux ménages
**Recommendation**: Considérer Web Worker

---

### 11. **useAuditData** 📊 Audit
**Fichier**: `src/hooks/useAuditData.ts`  
**Usage**: Ligne 120 (Terrain.tsx)
```typescript
const { auditResult } = useAuditData(households);
```
**Responsabilité**: Calculer stats audit
**Performance Impact**: ⚠️ Recalcule à chaque update households
**Recommendation**: Memoizer résultats

---

### 12. **useRouting** 🛣️ Itinéraire
**Fichier**: `src/hooks/useRouting.ts`  
**Usage**: Ligne 121-129 (Terrain.tsx)
```typescript
const {
    setRoutingEnabled,
    setRoutingStart,
    setRoutingDest,
    setRouteStats,
    routeStats,
    turnByTurnInstructions,
    cancelRouting
} = useRouting();
```
**Responsabilité**: Gérer itinéraires + appel API OSRM
**Performance Impact**: ⚠️ API externe
**Recommandation**: Ajouter timeout sur API

---

### 13. **useFavorites** ❤️ Favoris
**Fichier**: `src/hooks/useFavorites.ts`  
**Usage**: Ligne 131 (Terrain.tsx)
```typescript
const { isFavorite, toggleFavorite, favorites: localFavorites } = useFavorites(project?.id);
```
**Responsabilité**: Gestion favoris locaux
**Storage**: LocalStorage
**Performance Impact**: ✅ Minimal

---

### 14. **useTerrainUIStore** (Zustand) 🎨 UI State
**Fichier**: `src/store/terrainUIStore.ts`  
**Usage**: Ligne 72+ (Terrain.tsx)
```typescript
const activePanel = useTerrainUIStore(s => s.activePanel);
const setPanel = (p: any) => useTerrainUIStore.getState().setPanel(p);
const closePanel = useTerrainUIStore(s => s.closePanel);
const viewMode = useTerrainUIStore(s => s.viewMode);
// ... 10+ autres sélecteurs
```
**Responsabilité**: État UI centralisée (pannels, mode vue, etc)
**Performance Impact**: ✅ Optimisé (Zustand)

---

### 15. **useTheme** 🎨 Thème
**Fichier**: `src/contexts/ThemeContext`  
**Usage**: Ligne 78 (MapLibreVectorMap.tsx, utilisé indirectement)
```typescript
const { isDarkMode } = useTheme();
```
**Responsabilité**: Mode clair/sombre
**Performance Impact**: ✅ Minimal

---

### 16. **useViewportLoading** 🔄 Viewport
**Fichier**: `src/hooks/useViewportLoading.ts`  
**Usage**: MapLibreVectorMap.tsx (désactivé)
```typescript
useViewportLoading({
    enabled: false,  // ⚠️ Intentionnellement désactivé
    projectId,
    debounceMs: 300,
});
```
**Responsabilité**: Charger données basées viewport visible
**Status**: ❌ Désactivé pour montrer tous les ménages
**Recommandation**: Pourrait réactiver si UX acceptable

---

## 🔗 DÉPENDANCES ENTRE HOOKS

```
useTerrainData
    ↓
useMapFilters (utilise households)
    ↓
Affichage liste + carte

useProject
    ↓
useLogistique
    ↓
GrappeSelectorPanel

useAuth
usePermissions
    ↓
Vérification droits accès

useSync
    ↓
useTerrainData (re-trigger)
```

---

## ⚙️ ORCHESTRATION OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│                    TERRAIN.TSX                          │
│                                                         │
│  useAuth() ─┐                                           │
│  useProject()─┼─→ [User Context]                        │
│  useSync() ───┤                                         │
│              │                                          │
│  useMapFilters() ─→ [Search + Filter]                  │
│      ↑                    ↓                              │
│      │         [Filtered Households]                   │
│      │                    ↓                              │
│      └─────── MAP + LIST VIEW                          │
│                                                         │
│  useGrappeClustering() ─→ [Grappe Zones]               │
│  useAuditData() ─→ [Audit Stats]                       │
│  useRouting() ─→ [Itinerary]                           │
│  useFavorites() ─→ [Local Favorites]                   │
│                                                         │
│  useTerrainUIStore() ─→ [UI State - Zustand]          │
│                                                         │
│  useSyncListener() ←→ [Global Sync Bus]                │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 POINTS D'OPTIMISATION

### 🔴 Critique
1. **useMapFilters** - ✅ CORRIGÉ (debounce cleanup)
2. **useTerrainData** - ⚠️ Charge tout, pas de pagination

### 🟡 Important
3. **useAuditData** - Recalcule à chaque update
4. **useGrappeClustering** - Peut bloquer sur gros datasets

### 🟢 À considérer
5. **useViewportLoading** - Pourrait réactiver
6. **useRouting** - Ajouter timeout API

---

## 📊 RÉSUMÉ

| Hook | Criticité | Performance | Type | Status |
|------|-----------|-------------|------|--------|
| useTerrainData | ⭐ | 🟡 | Données | ⚠️ À optimiser |
| useMapFilters | ⭐ | 🟢 | Filtrage | ✅ Corrigé |
| useAuth | 🟡 | ✅ | Auth | ✅ OK |
| useProject | ⭐ | ✅ | CRUD | ✅ OK |
| useSync | ⭐ | 🟡 | Sync | ✅ OK |
| useGeolocation | 🟡 | ✅ | GPS | ✅ OK |
| useGrappeClustering | 🟡 | 🟡 | Clustering | ⚠️ À profiler |
| useAuditData | 🟡 | 🟡 | Stats | ⚠️ À memoizer |
| useRouting | 🟡 | 🟡 | Navigation | ⚠️ Timeout API |
| useFavorites | 🟢 | ✅ | UI | ✅ OK |
| usePermissions | 🟡 | ✅ | Sécurité | ✅ OK |
| useTerrainUIStore | ⭐ | ✅ | State | ✅ OK |
| useSyncListener | 🟡 | ✅ | Events | ✅ OK |
| useViewportLoading | 🟢 | 🟢 | Viewport | ❌ Désactivé |
| useTheme | 🟢 | ✅ | UI | ✅ OK |

---

**Note**: Cet audit a servi à identifier les 3 problèmes critiques corrigés dans le rapport final.

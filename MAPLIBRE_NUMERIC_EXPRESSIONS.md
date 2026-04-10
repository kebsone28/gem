# 🗺️ MapLibre/Mapbox - Expressions de Style & Filtres Numériques

## 📄 Fichiers Analysés
- `frontend/src/components/terrain/MapLibreVectorMap.tsx` (Principal)
- `frontend/src/components/terrain/GeoJsonOverlay.tsx`
- `frontend/src/hooks/useMapFilters.ts`
- `frontend/src/components/terrain/useMapClustering.ts`

---

## 1️⃣ HEATMAP LAYER - Style avec Interpolation Zoom

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L700)

**Layer ID:** `heatmap`  
**Type:** `heatmap`  
**Source:** `households` (MVT)

### Code Exact:
```typescript
if (!map.getLayer('heatmap')) {
    map.addLayer({
        id: 'heatmap',
        type: 'heatmap',
        source: 'households',
        layout: { visibility: 'none' },
        paint: {
            // ✅ NUMERIC: Interpolate weight based on zoom level
            'heatmap-weight': [
                'interpolate', ['linear'], ['zoom'],
                0, 0.3,      // zoom 0: weight 0.3
                15, 1        // zoom 15: weight 1
            ],
            
            // ✅ NUMERIC: Interpolate intensity based on zoom
            'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                0, 0.5,      // zoom 0: intensity 0.5
                15, 3        // zoom 15: intensity 3
            ],
            
            // ✅ NUMERIC: Interpolate radius based on zoom
            'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                0, 8,        // zoom 0: radius 8px
                15, 30       // zoom 15: radius 30px
            ],
            
            'heatmap-opacity': 0.7,
            
            // ✅ COLOR EXPRESSION: Interpolate heatmap-density (0-1 range)
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0,     'rgba(0,0,0,0)',    // 0% density: transparent
                0.1,   '#4f46e5',          // 10% density: indigo
                0.3,   '#7c3aed',          // 30% density: violet
                0.5,   '#ef4444',          // 50% density: red
                0.8,   '#f97316',          // 80% density: orange
                1,     '#fbbf24'           // 100% density: amber
            ]
        }
    });
}
```

**Notes:**
- Champs numériques: `zoom`, `heatmap-density`
- Propriétés numériques: `heatmap-weight`, `heatmap-intensity`, `heatmap-radius`
- Stratégie: interpolation linéaire sur zoom et densité

---

## 2️⃣ SERVER HOUSEHOLDS LAYER - Icon Size avec Zoom

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L745)

**Layer ID:** `households-server-layer`  
**Type:** `symbol`  
**Source:** `households-mvt` (MVT)

### Code Exact:
```typescript
if (!map.getLayer('households-server-layer')) {
    map.addLayer({
        id: 'households-server-layer',
        type: 'symbol',
        source: 'households-mvt',
        'source-layer': 'households',
        minzoom: 0,
        layout: {
            // ✅ CATEGORICAL: Match status field to icon image
            'icon-image': [
                'match',
                ['coalesce', ['get', 'status'], 'default'],
                'Contrôle conforme', 'icon-Contrôle conforme',
                'Non conforme', 'icon-Non conforme',
                'Intérieur terminé', 'icon-Intérieur terminé',
                'Réseau terminé', 'icon-Réseau terminé',
                'Murs terminés', 'icon-Murs terminés',
                'Livraison effectuée', 'icon-Livraison effectuée',
                'Non encore commencé', 'icon-Non encore commencé',
                'icon-default'
            ],
            
            // ✅ NUMERIC: Interpolate icon-size based on zoom
            'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                3, 0.15,    // zoom 3: size 0.15
                6, 0.25,    // zoom 6: size 0.25
                10, 0.4,    // zoom 10: size 0.4
                14, 0.7,    // zoom 14: size 0.7
                18, 1       // zoom 18: size 1.0
            ],
            
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'visibility': 'visible'
        },
        paint: {
            // ✅ NUMERIC: Interpolate opacity based on zoom
            'icon-opacity': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.6,    // zoom 10: opacity 0.6 (faded when zoomed out)
                14, 1.0     // zoom 14: opacity 1.0 (full when zoomed in)
            ]
        }
    });
}
```

**Notes:**
- Champs numériques: `zoom`, `status` (gets icon via match)
- Propriétés numériques: `icon-size`, `icon-opacity`
- Deux expressions interpolation pour adapter la taille et opacité au niveau de zoom

---

## 3️⃣ LOCAL HOUSEHOLDS LAYER - Icon Size avec Zoom

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L780)

**Layer ID:** `households-local-layer`  
**Type:** `symbol`  
**Source:** `households` (GeoJSON)

### Code Exact:
```typescript
if (!map.getLayer('households-local-layer')) {
    map.addLayer({
        id: 'households-local-layer',
        type: 'symbol',
        source: 'households',
        minzoom: 0,
        layout: {
            // ✅ CATEGORICAL: Match status to icon
            'icon-image': [
                'match',
                ['coalesce', ['get', 'status'], 'default'],
                'Contrôle conforme', 'icon-Contrôle conforme',
                'Non conforme', 'icon-Non conforme',
                'Intérieur terminé', 'icon-Intérieur terminé',
                'Réseau terminé', 'icon-Réseau terminé',
                'Murs terminés', 'icon-Murs terminés',
                'Livraison effectuée', 'icon-Livraison effectuée',
                'Non encore commencé', 'icon-Non encore commencé',
                'icon-default'
            ],
            
            // ✅ NUMERIC: Size interpolation (slightly larger than server layer)
            'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                3, 0.20,    // zoom 3: size 0.20 (bigger to highlight local changes)
                6, 0.35,    // zoom 6: size 0.35
                10, 0.5,    // zoom 10: size 0.5
                14, 0.8,    // zoom 14: size 0.8
                18, 1.1     // zoom 18: size 1.1
            ],
            
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'visibility': 'visible'
        },
        paint: {
            // Halo effect for local points distinction
            'icon-halo-color': '#ffffff',
            'icon-halo-width': 1
        }
    });
}
```

**Notes:**
- Champs numériques accédés: `zoom`, `status`
- Les petites tailles augmentées par rapport à server-layer pour distinguer les modifications locales

---

## 4️⃣ SYNC INDICATOR LAYER - Filter & Circle Radius

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L815)

**Layer ID:** `households-sync-indicator`  
**Type:** `circle`  
**Source:** `households` (GeoJSON)

### Code Exact:
```typescript
if (!map.getLayer('households-sync-indicator')) {
    map.addLayer({
        id: 'households-sync-indicator',
        type: 'circle',
        source: 'households',
        
        // ✅ FILTER: Show only if syncStatus is 'pending' or 'error'
        filter: ['in', ['coalesce', ['get', 'syncStatus'], ''], ['literal', ['pending', 'error']]],
        minzoom: 12,  // Only show when zoomed in to avoid clutter
        
        paint: {
            // ✅ NUMERIC: Fixed circle-radius (small indicator dot)
            'circle-radius': 5,
            
            // ✅ COLOR: Match syncStatus field
            'circle-color': [
                'match',
                ['get', 'syncStatus'],
                'pending', '#f59e0b',    // amber for pending
                'error', '#ef4444',      // red for error
                'transparent'
            ],
            
            // ✅ NUMERIC: Stroke width (numeric property)
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            
            // ✅ NUMERIC: Translate offset (position adjustment)
            'circle-translate': [8, -8]  // offset to top right of the pin
        }
    });
}
```

**Notes:**
- **Filter numérique:** `['in', ['get', 'syncStatus'], ['literal', ['pending', 'error']]]`
- **Propriétés numériques:** `circle-radius: 5`, `circle-stroke-width: 1.5`, `circle-translate: [8, -8]`
- Filtre sur enum string mais stratégie numérique via indices

---

## 5️⃣ CLUSTER CIRCLES LAYER - Step Expression sur Zoom

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L850)

**Layer ID:** `cluster-circles`  
**Type:** `circle`  
**Source:** `supercluster-generated`

### Code Exact:
```typescript
if (!map.getLayer('cluster-circles')) {
    map.addLayer({
        id: 'cluster-circles',
        type: 'circle',
        source: 'supercluster-generated',
        maxzoom: 12,  // ✅ Only show clusters when zoomed OUT
        
        // ✅ FILTER: Only show features with point_count property
        filter: ['has', 'point_count'],
        
        paint: {
            'circle-color': '#3b82f6',
            
            // ✅ NUMERIC: STEP expression - circle radius increases with point count
            'circle-radius': [
                'step',
                ['to-number', ['get', 'point_count'], 0],  // Convert point_count to number (default 0)
                18,    // radius 18px if point_count < 50
                50, 24,    // radius 24px if point_count >= 50
                200, 30    // radius 30px if point_count >= 200
            ],
            
            // ✅ NUMERIC: Stroke width
            'circle-stroke-width': 3,
            'circle-stroke-color': '#1e40af',
            
            // ✅ NUMERIC: Interpolate opacity based on zoom
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 0.8,    // zoom 5: opacity 0.8
                10, 0.4,   // zoom 10: opacity 0.4
                12, 0      // zoom 12: opacity 0 (fade out)
            ]
        }
    });
}
```

**Notes:**
- **STEP expression:** Très important ! Radius augmente par palier selon `point_count`
- **Conversion numérique:** `['to-number', ['get', 'point_count'], 0]`
- **Opacity:** Interpolation linéaire sur zoom (zoom 5→10→12)
- Comportement: Clusters visibles <12, disparaissent au zoom 12

---

## 6️⃣ AUTO-GRAPPES FILL LAYER - Case Expression avec Hover

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L580)

**Layer ID:** `auto-grappes-fill`  
**Type:** `fill`  
**Source:** `auto-grappes`

### Code Exact:
```typescript
if (!map.getLayer('auto-grappes-fill')) {
    map.addLayer({
        id: 'auto-grappes-fill',
        type: 'fill',
        source: 'auto-grappes',
        layout: { visibility: 'visible' },
        paint: {
            // ✅ COLOR: Case expression based on 'type' field
            'fill-color': ['case',
                ['==', ['get', 'type'], 'dense'], '#10b981',      // emerald if type==dense
                ['==', ['get', 'type'], 'kmeans'], '#f59e0b',     // amber if type==kmeans
                '#3b82f6'                                           // default blue
            ],
            
            // ✅ NUMERIC CASE: fill-opacity changes on hover
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false], 0.5,  // 0.5 if hover=true
                0.15                                                    // 0.15 by default
            ]
        }
    });
}
```

**Notes:**
- **Feature-state:** Accès à l'état `hover` (booléen)
- **Opacity numérique:** 0.5 au survol, 0.15 par défaut
- Requires `map.setFeatureState()` pour fonctionner

---

## 7️⃣ AUTO-GRAPPES OUTLINE LAYER - Line Color & Width

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L608)

**Layer ID:** `auto-grappes-outline`  
**Type:** `line`  
**Source:** `auto-grappes`

### Code Exact:
```typescript
if (!map.getLayer('auto-grappes-outline')) {
    map.addLayer({
        id: 'auto-grappes-outline',
        type: 'line',
        source: 'auto-grappes',
        layout: { visibility: 'visible' },
        paint: {
            // ✅ COLOR: Case on 'type' field
            'line-color': ['case',
                ['==', ['get', 'type'], 'dense'], '#059669',      // dark emerald
                ['==', ['get', 'type'], 'kmeans'], '#d97706',     // dark amber
                '#2563eb'                                           // default darker blue
            ],
            
            // ✅ NUMERIC: Fixed line width
            'line-width': 2.5,
            
            // ✅ NUMERIC: Fixed line opacity
            'line-opacity': 0.8
        }
    });
}
```

**Notes:**
- `line-width: 2.5` (pas d'interpolation, juste numérique)
- `line-opacity: 0.8` (numérique fixe)
- Case expression sur `type` pour les couleurs

---

## 8️⃣ ROUTE HIGHLIGHT LAYER - Opacity Interpolation

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L525)

**Layer ID:** `route-highlight-layer`  
**Type:** `line`  
**Source:** `route-source`

### Code Exact:
```typescript
if (!map.getLayer('route-highlight-layer')) {
    map.addLayer({
        id: 'route-highlight-layer',
        type: 'line',
        source: 'route-source',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#fbbf24',  // Amber
            
            // ✅ NUMERIC: Fixed width
            'line-width': 7,
            
            // ✅ NUMERIC: Interpolate opacity on zoom to improve visibility
            'line-opacity': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.6,   // zoom 10: opacity 0.6
                15, 0.9    // zoom 15: opacity 0.9
            ]
        }
    }, 'route-layer');  // Insère avant 'route-layer'
}
```

**Notes:**
- `line-width: 7` (fixe, numérique)
- `line-opacity` utilise interpolation linéaire sur zoom
- Positionnement: insérée avant 'route-layer' dans l'ordre des couches

---

## 9️⃣ AUTO-GRAPPES LABELS - Numeric Text Conversion

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L635)

**Layer ID:** `auto-grappes-labels`  
**Type:** `symbol`  
**Source:** `auto-grappes-centroids`

### Code Exact:
```typescript
if (map.getSource('auto-grappes-centroids') && !map.getLayer('auto-grappes-labels')) {
    map.addLayer({
        id: 'auto-grappes-labels',
        type: 'symbol',
        source: 'auto-grappes-centroids',
        layout: {
            visibility: 'visible',
            
            // ✅ NUMERIC: Concatenate string with numeric count
            'text-field': [
                'concat',
                ['to-string', ['coalesce', ['get', 'name'], 'Zone']],
                '\n',
                ['to-string', ['to-number', ['get', 'count'], 0]],  // Convert count to string
                ' pts'
            ],
            
            // ✅ NUMERIC: Text size (fixed)
            'text-size': 12,
            
            // ✅ NUMERIC: Offset positioning
            'text-offset': [0, 0],
            'text-anchor': 'center'
        },
        paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            
            // ✅ NUMERIC: Halo width
            'text-halo-width': 2
        }
    });
}
```

**Notes:**
- **Conversions numériques:** `['to-number', ['get', 'count'], 0]` puis `['to-string', ...]`
- **Text-size:** 12 (numérique)
- **Text-offset:** [0, 0] (coordonnées numériques)
- **Text-halo-width:** 2 (numérique)

---

## 🔟 GRAPPES LAYER (Hidden) - Circle Radius & Opacity

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L661)

**Layer ID:** `grappes-layer`  
**Type:** `circle`  
**Source:** `grappes`

### Code Exact:
```typescript
if (!map.getLayer('grappes-layer')) {
    map.addLayer({
        id: 'grappes-layer',
        type: 'circle',
        source: 'grappes',
        layout: { visibility: 'none' },  // Manuel/old zones (disabled)
        paint: {
            // ✅ NUMERIC: Fixed circle radius
            'circle-radius': 25,
            'circle-color': '#4f46e5',
            
            // ✅ NUMERIC: Opacity
            'circle-opacity': 0.2,
            
            // ✅ NUMERIC: Stroke width
            'circle-stroke-width': 2,
            'circle-stroke-color': '#4f46e5'
        }
    });
}
```

**Notes:**
- Couche masquée par défaut (visibility: none)
- Toutes les propriétés sont des nombres fixes
- Remplacée par auto-grappes pour une meilleure performance

---

## 1️⃣1️⃣ SOUS-GRAPPES LAYER (Hidden) - Circle Properties

**Fichier:** [MapLibreVectorMap.tsx](frontend/src/components/terrain/MapLibreVectorMap.tsx#L687)

**Layer ID:** `sous-grappes-layer`  
**Type:** `circle`  
**Source:** `sous-grappes`

### Code Exact:
```typescript
if (!map.getLayer('sous-grappes-layer')) {
    map.addLayer({
        id: 'sous-grappes-layer',
        type: 'circle',
        source: 'sous-grappes',
        layout: { visibility: 'none' },
        paint: {
            // ✅ NUMERIC: Small circle radius
            'circle-radius': 12,
            'circle-color': '#10b981',
            
            // ✅ NUMERIC: Opacity
            'circle-opacity': 0.3,
            
            // ✅ NUMERIC: Stroke width
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#10b981'
        }
    });
}
```

**Notes:**
- Comparable à grappes-layer mais plus petite (radius: 12 vs 25)
- Masquée par défaut
- Toutes propriétés numériques fixes

---

## Résumé des Patterns Utilisés

### 🔢 Expressions Numériques Principales:

| Expression | Champs Numériques | Propriétés Numériques | Exemple |
|-----------|-----------------|---------------------|---------|
| **interpolate** | `['zoom']`, `['heatmap-density']` | `icon-size`, `line-opacity`, `circle-radius` | Heatmap layer #1 |
| **step** | `['to-number', ['get', 'point_count']]` | `circle-radius` | Cluster circles #5 |
| **case** | `['boolean', ['feature-state', 'hover']]` | `fill-opacity` | Grappes fill #6 |
| **match** | `['get', 'type']` | `fill-color` (output) | Auto-grappes #6, #7 |
| **to-number** | `['get', 'count']`, `['get', 'point_count']` | Conversion avant step/interpolate | Labels #9, Clusters #5 |
| **to-string** | `['get', 'count']`, `['get', 'point_count_abbreviated']` | `text-field` | Labels #9 |
| **filter** | `['in', [...]]`, `['has', 'property']` | N/A (appliqué à layer) | Sync indicator #4, Clusters #5 |

### 📊 Propriétés Numériques Utilisées:

**Layout:**
- `icon-size` (0.15 - 1.1)
- `text-size` (10 - 14)
- `text-offset` ([0,0])

**Paint:**
- `circle-radius` (5 - 30)
- `circle-opacity` (0 - 0.8)
- `circle-stroke-width` (1 - 3)
- `circle-translate` ([8, -8])
- `line-width` (1.5 - 7)
- `line-opacity` (0 - 0.9)
- `fill-opacity` (0.05 - 0.5)
- `icon-opacity` (0.6 - 1.0)
- `text-halo-width` (1 - 2)
- `heatmap-weight` (0.3 - 1)
- `heatmap-intensity` (0.5 - 3)
- `heatmap-radius` (8 - 30)

---

## 🎯 Cas d'Usage par Domaine:

### **Zoom-based Scaling**
- Heatmap layer (radius, weight, intensity interpolate sur zoom)
- Icon size (interpolate sur zoom)
- Line opacity (interpolate sur zoom)

### **Count-based Sizing**
- Cluster radius (step sur point_count)
- Text content (to-number + to-string sur count)

### **State-based Opacity**
- Fill opacity (case sur feature-state hover)
- Sync indicator visibility (filter in/out)

### **Categorical Mapping**
- Icon selection (match sur status)
- Color mapping (case/match sur type)

---

## 🔗 Fichiers Source Complets

- [MapLibreVectorMap.tsx - Full File](frontend/src/components/terrain/MapLibreVectorMap.tsx)
- [GeoJsonOverlay.tsx - Full File](frontend/src/components/terrain/GeoJsonOverlay.tsx)
- [useMapFilters.ts - Full File](frontend/src/hooks/useMapFilters.ts)
- [useMapClustering.ts - Full File](frontend/src/components/terrain/useMapClustering.ts)


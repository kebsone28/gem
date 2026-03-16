/**
 * MapLibreVectorMap.tsx
 * 
 * Version ULTRA-INTERACTIVE avec :
 * - Clic sur points et clusters (zoom automatique)
 * - Calques de Zones (Grappes) et Sous-Grappes avec couleurs distinctes
 * - Curseurs 'pointer' sur les zones actives
 * - Correction des bugs de rendu MapLibre
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ✅ Optimize worker threads for tablet/mobile terrain use
maplibregl.setWorkerCount(2);
import { RefreshCw } from 'lucide-react';
import { getHouseholdDerivedStatus } from '../../utils/statusUtils';
import { householdsToGeoJSON } from '../../utils/clusteringUtils';
import { useViewportLoading } from '../../hooks/useViewportLoading';
import logger from '../../utils/logger';
import { senegalRegions } from '../../data/senegal-regions';

// Import refactored modules
import { 
    getStatusColor, MAP_STYLE_DARK, MAP_STYLE_LIGHT, 
    MAP_STYLE_SATELLITE, getIconId
} from './mapConfig';
import { loadMapImages, isValidCoordinate } from './mapUtils';
import { useMemoDeep } from './useMapMemoization';
import { fetchOSRMRoute, buildRouteGeoJSON } from './mapRouting';
import { useMapInteractions } from './useMapInteractions';
import { useMapClustering } from './useMapClustering';
import { useMemorizedSupercluster } from './useMemorizedSupercluster';
import { useMapMarkers } from './useMapMarkers';
import { useMapMeasure } from './useMapMeasure';
import { useMapVisibility } from './useMapVisibility';

// ── Configuration Visuelle ──
// (All configurations moved to mapConfig.ts - imported above)

// ── Helpers ──
const toLngLat = (coords: [number, number]): [number, number] => {
    // Senegal context: Lng is negative (~-17 to -11), Lat is positive (~12 to 17)
    // If coords[0] is positive and coords[1] is negative, it's [lat, lng] -> SWAP to [lng, lat]
    if (coords[0] > 0 && coords[1] < 0) return [coords[1], coords[0]];
    return coords;
};

const toLatLng = (coords: [number, number]): [number, number] => {
    // If coords[0] is negative and coords[1] is positive, it's [lng, lat] -> SWAP to [lat, lng]
    if (coords[0] < 0 && coords[1] > 0) return [coords[1], coords[0]];
    return coords;
};
const SLOW_JITTER_EPSILON = 0.00008; // Ultra-fast jitter for 50k+ performance

export default function MapLibreVectorMap({
    households,
    mapCommand,
    isDarkMode,
    onSelectHousehold,
    showHeatmap = false,
    showZones = false,
    onZoneClick,
    grappesConfig,
    readOnly = false,
    isMeasuring = false,
    mapStyle = 'streets',
    grappeZonesData,
    grappeCentroidsData,
    activeGrappeId,
    userLocation,
    onHouseholdDrop,
    routingEnabled,
    routingStart,
    routingDest,
    onRouteFound,
    onMove,
    followUser = false,
    favorites = [],
    projectId
}: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [styleIsReady, setStyleIsReady] = useState(false);
    const [isRoutingLoading, setIsRoutingLoading] = useState(false);

    // Refs pour éviter les closures périmées (stale closures) dans les event listeners de MapLibre
    const householdsRef = useRef(households);
    const onSelectRef = useRef(onSelectHousehold);
    const onZoneClickRef = useRef(onZoneClick);
    const onDropRef = useRef(onHouseholdDrop);
    const onMoveRef = useRef(onMove);
    const favoritesRef = useRef(favorites);
    const grappesConfigRef = useRef(grappesConfig);
    const grappeZonesDataRef = useRef(grappeZonesData);
    const grappeCentroidsDataRef = useRef(grappeCentroidsData);

    // ✅ Shared event handler refs for perfect map.off() cleanup
    const handlersRef = useRef<Record<string, Function>>({});

    // Supercluster ref for high-performance clustering
    const superclusterRef = useMemorizedSupercluster(households);

    // ✅ Hook extraction for modularity
    const { setupInteractions } = useMapInteractions(readOnly, householdsRef, onSelectRef, onZoneClickRef, onDropRef);
    const { setupClusteringEvents } = useMapClustering(superclusterRef);
    const { setupUserMarker, cleanup: cleanupMarker } = useMapMarkers(userLocation);
    const { setupMeasureTool } = useMapMeasure();
    const { setupVisibility } = useMapVisibility(showHeatmap, showZones, styleIsReady);

    // ✅ Viewport loading - Enabled for large datasets
    // Allows loading only visible households based on map viewport
    // Reduces bandwidth by ~95% for large datasets (50k+ points)
    // Uses PostGIS spatial query via GET /households?bbox=...
    const { updateViewport } = useViewportLoading({
        enabled: true,
        projectId,
        debounceMs: 300,
        onHouseholdsLoaded: (households) => {
            if (mapRef.current && households.length > 0) {
                const geoJSON = householdsToGeoJSON(households);
                (mapRef.current.getSource('households') as any)?.setData(geoJSON);
                logger.debug(`📍 Viewport loaded ${households.length} households`);
            }
        }
    });

    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { onSelectRef.current = onSelectHousehold; }, [onSelectHousehold]);
    useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);
    useEffect(() => { onDropRef.current = onHouseholdDrop; }, [onHouseholdDrop]);
    useEffect(() => { onMoveRef.current = (coords: [number, number], zoom: number) => onMove?.(toLatLng(coords), zoom); }, [onMove]);
    useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
    useEffect(() => { grappesConfigRef.current = grappesConfig; }, [grappesConfig]);
    useEffect(() => { grappeZonesDataRef.current = grappeZonesData; }, [grappeZonesData]);
    useEffect(() => { grappeCentroidsDataRef.current = grappeCentroidsData; }, [grappeCentroidsData]);

    // GéoJSON des Ménages avec correction jitter (décalage spirale pour coordonnées dupliquées)
    // ✅ Using useMemoDeep for deep memoization - prevents recalculation on 50k+ points
    const householdGeoJSON = useMemoDeep(() => {
        const valid = (households || []).filter((h: any) => isValidCoordinate(h.location?.coordinates));

        // Compter les doublons de coordonnées et appliquer un offset spirale
        const coordCount: Record<string, number> = {};

        return {
            type: 'FeatureCollection',
            features: valid.map((h: any) => {
                let coordinates = h.location.coordinates as [number, number];
                const key = `${coordinates[0].toFixed(5)}_${coordinates[1].toFixed(5)}`;
                const n = coordCount[key] ?? 0;
                coordCount[key] = n + 1;

                // Apply jitter for duplicate coordinates
                if (n > 0) {
                    // ✅ FAST JITTER: use simple random offset for 50k+ performance
                    coordinates = [
                        coordinates[0] + (Math.random() - 0.5) * SLOW_JITTER_EPSILON * Math.sqrt(n),
                        coordinates[1] + (Math.random() - 0.5) * SLOW_JITTER_EPSILON * Math.sqrt(n)
                    ];
                }

                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates },
                    properties: {
                        id: h.id,
                        status: getHouseholdDerivedStatus(h),
                        color: getStatusColor(getHouseholdDerivedStatus(h)),
                        iconId: getIconId(getHouseholdDerivedStatus(h))
                    }
                };
            })
        };
    }, [households]);

    // GéoJSON des Favoris
    const favoritesGeoJSON = useMemo(() => {
        const favoriteIds = (favorites || []).map((f: any) => f.householdId);
        const favHouseholds = (households || []).filter((h: any) => favoriteIds.includes(h.id));

        return {
            type: 'FeatureCollection',
            features: favHouseholds.map((h: any) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [h.location.coordinates[0], h.location.coordinates[1]] },
                properties: { id: h.id, type: 'favorite' }
            }))
        };
    }, [households, favorites]);

    // GéoJSON des Grappes (Zones)
    const grappesGeoJSON = useMemo(() => ({
        type: 'FeatureCollection',
        features: (grappesConfig?.grappes || [])
            .filter((g: any) => g.centroide_lon != null && g.centroide_lat != null)
            .map((g: any) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(g.centroide_lon), Number(g.centroide_lat)] },
                properties: { id: g.id, nom: g.nom, type: 'grappe' }
            }))
    }), [grappesConfig]);

    // GéoJSON des Sous-Grappes
    const sousGrappesGeoJSON = useMemo(() => ({
        type: 'FeatureCollection',
        features: (grappesConfig?.sous_grappes || [])
            .filter((sg: any) => sg.centroide_lon != null && sg.centroide_lat != null)
            .map((sg: any) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(sg.centroide_lon), Number(sg.centroide_lat)] },
                properties: { id: sg.id, nom: sg.nom, grappe_id: sg.grappe_id, type: 'sous_grappe' }
            }))
    }), [grappesConfig]);

    const setupLayersLock = useRef(false);

    const setupLayers = useCallback(async (map: maplibregl.Map) => {
        if (!map || setupLayersLock.current) return;

        try {
            setupLayersLock.current = true;
            
            // ✅ Ensure style is fully loaded before loading images
            if (!map.isStyleLoaded?.()) {
                logger.log('⏳ Waiting for style to load before loading images...');
                setupLayersLock.current = false;
                return;
            }
            
            await loadMapImages(map);

            if (map.getSource('households')) {
                setupLayersLock.current = false;
                return;
            }

            // --- SOURCES ---
            // Source MVT pour les performances (PostGIS)
            const apiUrl = import.meta.env.VITE_API_URL || '/api';
            if (!map.getSource('households-mvt')) {
                map.addSource('households-mvt', {
                    type: 'vector',
                    tiles: [`${window.location.origin}${apiUrl}/geo/mvt/households/{z}/{x}/{y}`],
                    minzoom: 0,
                    maxzoom: 14
                });
            }

            // Fallback GeoJSON pour le offline / petits datasets
            if (!map.getSource('households')) {
                map.addSource('households', {
                    type: 'geojson',
                    data: householdGeoJSON as any,
                    cluster: false
                });
            }

            if (!map.getSource('grappes')) {
                map.addSource('grappes', { type: 'geojson', data: grappesGeoJSON as any });
            }
            if (!map.getSource('sous-grappes')) {
                map.addSource('sous-grappes', { type: 'geojson', data: sousGrappesGeoJSON as any });
            }

            if (!map.getSource('auto-grappes')) {
                if (grappeZonesDataRef.current) {
                    map.addSource('auto-grappes', { type: 'geojson', data: grappeZonesDataRef.current });
                } else {
                    map.addSource('auto-grappes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                }
            }

            if (!map.getSource('auto-grappes-centroids')) {
                if (grappeCentroidsDataRef.current) {
                    map.addSource('auto-grappes-centroids', { type: 'geojson', data: grappeCentroidsDataRef.current });
                } else {
                    map.addSource('auto-grappes-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                }
            }

            // Source pour les favoris
            if (!map.getSource('favorites-source')) {
                map.addSource('favorites-source', {
                    type: 'geojson',
                    data: (favoritesRef.current || []) as any
                });
            }

            // ✅ Source pour les clusters générés par Supercluster (mise à jour dynamique au zoom)
            if (!map.getSource('supercluster-generated')) {
                map.addSource('supercluster-generated', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // --- LAYERS ---
            if (!map.getLayer('favorites-layer')) {
                map.addLayer({
                    id: 'favorites-layer',
                    type: 'circle',
                    source: 'favorites-source',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': '#fbbf24',
                        'circle-opacity': 0.4,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#fbbf24'
                    }
                });
            }

            if (!map.getLayer('favorites-outline')) {
                map.addLayer({
                    id: 'favorites-outline',
                    type: 'circle',
                    source: 'favorites-source',
                    paint: {
                        'circle-radius': 12,
                        'circle-color': 'transparent',
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#fbbf24',
                        'circle-stroke-opacity': 0.5
                    }
                });
            }

            // Source pour l'itinéraire de routage
            if (!map.getSource('route-source')) {
                map.addSource('route-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // Source pour les régions du Sénégal
            if (!map.getSource('senegal-regions')) {
                map.addSource('senegal-regions', {
                    type: 'geojson',
                    data: senegalRegions as any
                });
            }

            if (!map.getLayer('route-layer')) {
                map.addLayer({
                    id: 'route-layer',
                    type: 'line',
                    source: 'route-source',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#10b981',
                        'line-width': 5,
                        'line-opacity': 0.8
                    }
                });
            }

            // Couche de highlight pour la route active
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
                        'line-color': '#fbbf24', // Amber pour mettre en évidence
                        'line-width': 7,
                        'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 0.9]
                    }
                }, 'route-layer'); // Placer au-dessus de la route principale
            }

            // --- LAYERS : RÉGIONS DU SÉNÉGAL ---
            if (!map.getLayer('senegal-regions-fill')) {
                map.addLayer({
                    id: 'senegal-regions-fill',
                    type: 'fill',
                    source: 'senegal-regions',
                    paint: {
                        'fill-color': '#cbd5e1',
                        'fill-opacity': 0.05
                    }
                });
            }

            if (!map.getLayer('senegal-regions-outline')) {
                map.addLayer({
                    id: 'senegal-regions-outline',
                    type: 'line',
                    source: 'senegal-regions',
                    paint: {
                        'line-color': '#64748b',
                        'line-width': 1.5,
                        'line-opacity': 0.4,
                        'line-dasharray': [2, 2]
                    }
                });
            }

            if (!map.getLayer('senegal-regions-label')) {
                map.addLayer({
                    id: 'senegal-regions-label',
                    type: 'symbol',
                    source: 'senegal-regions',
                    layout: {
                        'text-field': ['to-string', ['coalesce', ['get', 'REGION'], 'Sénégal']],
                        'text-size': 12,
                        'text-font': ['Noto Sans Regular'],
                        'text-offset': [0, 0],
                        'text-anchor': 'center'
                    },
                    paint: {
                        'text-color': '#475569',
                        'text-opacity': 0.6
                    }
                });
            }

            // --- LAYERS : AUTO-GRAPPES (Régionalisation) - TOUJOURS AFFICHÉES ---
            if (!map.getLayer('auto-grappes-fill')) {
                map.addLayer({
                    id: 'auto-grappes-fill',
                    type: 'fill',
                    source: 'auto-grappes',
                    layout: { visibility: 'visible' },
                    paint: {
                        'fill-color': ['case',
                            ['==', ['get', 'type'], 'dense'], '#10b981', // emerald
                            ['==', ['get', 'type'], 'kmeans'], '#f59e0b', // amber
                            '#3b82f6' // default
                        ],
                        'fill-opacity': [
                            'case',
                            ['boolean', ['feature-state', 'hover'], false], 0.5,
                            0.15
                        ]
                    }
                });
            }

            if (!map.getLayer('auto-grappes-outline')) {
                map.addLayer({
                    id: 'auto-grappes-outline',
                    type: 'line',
                    source: 'auto-grappes',
                    layout: { visibility: 'visible' },
                    paint: {
                        'line-color': ['case',
                            ['==', ['get', 'type'], 'dense'], '#059669',
                            ['==', ['get', 'type'], 'kmeans'], '#d97706',
                            '#2563eb'
                        ],
                        'line-width': 2.5,
                        'line-opacity': 0.8
                    }
                });
            }

            if (map.getSource('auto-grappes-centroids') && !map.getLayer('auto-grappes-labels')) {
                map.addLayer({
                    id: 'auto-grappes-labels',
                    type: 'symbol',
                    source: 'auto-grappes-centroids',
                    layout: {
                        visibility: 'visible',
                        'text-field': [
                            'concat', 
                            ['to-string', ['coalesce', ['get', 'name'], 'Zone']], 
                            '\n', 
                            ['to-string', ['coalesce', ['get', 'count'], 0]], 
                            ' pts'
                        ],
                        'text-size': 12,
                        'text-font': ['Noto Sans Bold'],
                        'text-offset': [0, 0],
                        'text-anchor': 'center'
                    },
                    paint: {
                        'text-color': '#1e293b',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 2
                    }
                });
            }

            // --- LAYERS : ZONES (Grappes Manuelles/Anciennes) - MASQUÉES ---
            // Ces couches sont désactivées - utiliser les auto-grappes à la place
            map.addLayer({
                id: 'grappes-layer',
                type: 'circle',
                source: 'grappes',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': 25,
                    'circle-color': '#4f46e5',
                    'circle-opacity': 0.2,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#4f46e5'
                }
            });

            map.addLayer({
                id: 'grappes-labels',
                type: 'symbol',
                source: 'grappes',
                layout: {
                    visibility: 'none',
                    'text-field': ['to-string', ['coalesce', ['get', 'nom'], '']],
                    'text-size': 10,
                    'text-offset': [0, 3],
                    'text-anchor': 'top'
                },
                paint: { 'text-color': '#4f46e5', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            });

            // --- LAYERS : SOUS-GRAPPES - MASQUÉES ---
            map.addLayer({
                id: 'sous-grappes-layer',
                type: 'circle',
                source: 'sous-grappes',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': 12,
                    'circle-color': '#10b981',
                    'circle-opacity': 0.3,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#10b981'
                }
            });

            // --- LAYERS : MVT HOUSEHOLDS (Heatmap) ---
            map.addLayer({
                id: 'heatmap',
                type: 'heatmap',
                source: 'households',
                layout: { visibility: 'none' }, // toujours commencer caché
                paint: {
                    'heatmap-weight': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 0.3,
                        15, 1
                    ],
                    'heatmap-intensity': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 0.5,
                        15, 3
                    ],
                    'heatmap-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 8,
                        15, 30
                    ],
                    'heatmap-opacity': 0.7,
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(0,0,0,0)',
                        0.1, '#4f46e5',
                        0.3, '#7c3aed',
                        0.5, '#ef4444',
                        0.8, '#f97316',
                        1, '#fbbf24'
                    ]
                }
            });

            // ✅ 1. SERVER LAYER (High performance MVT foundation)
            map.addLayer({
                id: 'households-server-layer',
                type: 'symbol',
                source: 'households-mvt',
                'source-layer': 'households',
                minzoom: 0,
                layout: {
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
                    'icon-size': [
                        'interpolate', ['linear'], ['zoom'],
                        3, 0.15, 6, 0.25, 10, 0.4, 14, 0.7, 18, 1
                    ],
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'visibility': 'visible'
                },
                paint: {
                    'icon-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        10, 0.6, // Faded when zipped out to avoid visual noise
                        14, 1.0
                    ]
                }
            });

            // ✅ 2. LOCAL LAYER (Highly reactive GeoJSON for Outbox/Recent edits)
            if (!map.getLayer('households-local-layer')) {
                map.addLayer({
                    id: 'households-local-layer',
                    type: 'symbol',
                    source: 'households',
                    minzoom: 0,
                    layout: {
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
                        'icon-size': [
                            'interpolate', ['linear'], ['zoom'],
                            3, 0.20, // Slightly larger to highlight local changes
                            6, 0.35, 
                            10, 0.5, 
                            14, 0.8, 
                            18, 1.1
                        ],
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        'visibility': 'visible'
                    },
                    paint: {
                        // Slight halo effect for local points to distinguish them
                        'icon-halo-color': '#ffffff',
                        'icon-halo-width': 1
                    }
                });
            }

            // ✅ Cluster circles layer (visible when ZOOMED OUT < zoom 12)
            if (!map.getLayer('cluster-circles')) {
                map.addLayer({
                    id: 'cluster-circles',
                    type: 'circle',
                    source: 'supercluster-generated',
                    maxzoom: 12,  // ✅ Only show clusters when zoomed OUT
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': '#3b82f6',
                        'circle-radius': [
                            'step', 
                            ['number', ['get', 'point_count'], 0], 
                            18, 50, 24, 200, 30
                        ],
                        'circle-stroke-width': 3,
                        'circle-stroke-color': '#1e40af',
                        'circle-opacity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            5, 0.8,
                            10, 0.4,
                            12, 0
                        ]
                    }
                });
            }

            // ✅ Cluster count labels (visible when zoomed out)
            if (!map.getLayer('cluster-counts')) {
                map.addLayer({
                    id: 'cluster-counts',
                    type: 'symbol',
                    source: 'supercluster-generated',
                    maxzoom: 12,  // ✅ Only show at low zoom like clusters
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': ['coalesce', ['to-string', ['get', 'point_count_abbreviated']], ['to-string', ['get', 'point_count']], '0'],
                        'text-font': ['Noto Sans Bold'],
                        'text-size': 12
                    },
                    paint: {
                        'text-color': '#ffffff'
                    }
                });
            }

            // Source temporaire pour le drag & drop (visual feedback)
            if (!map.getSource('drag-point')) {
                map.addSource('drag-point', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            if (!map.getLayer('drag-point-layer')) {
                map.addLayer({
                    id: 'drag-point-layer',
                    type: 'circle',
                    source: 'drag-point',
                    paint: {
                        'circle-radius': 7,
                        'circle-color': '#ef4444',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });
            }

            // ✅ Setup interactions with the new layer IDs
            setupInteractions(map);

            setStyleIsReady(true);
        } finally {
            setupLayersLock.current = false;
        }
    }, [householdGeoJSON, favoritesGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, showHeatmap, showZones, setupInteractions, setupClusteringEvents]);

    // ✅ REFS for stability - prevents map re-initialization when these change
    const setupLayersRef = useRef(setupLayers);
    const updateViewportRef = useRef(updateViewport);
    useEffect(() => { setupLayersRef.current = setupLayers; }, [setupLayers]);
    useEffect(() => { updateViewportRef.current = updateViewport; }, [updateViewport]);

    // Initialisation
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return; // ✅ Robust double-init guard
        
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
            center: [-14.4563, 14.4563], // Default Senegal center
            zoom: 7,
            localIdeographFontFamily: 'sans-serif',
            trackResize: false // Improved performance
        });

        const onLoad = () => {
            logger.debug('🗺️ Map load event triggered');
            setupLayers(map);
        };
        
        const handleMoveEnd = () => {
            if (onMoveRef.current) {
                const c = map.getCenter();
                onMoveRef.current([c.lng, c.lat], map.getZoom());
            }

            // ✅ Trigger viewport loading on map move - use ref for stability
            if (updateViewportRef.current && map) {
                const bounds = map.getBounds();
                updateViewportRef.current({
                    lng1: bounds.getWest(),
                    lat1: bounds.getSouth(),
                    lng2: bounds.getEast(),
                    lat2: bounds.getNorth()
                });
            }
        };

        const handleStyleData = () => {
            // This is called when the style starts loading (e.g. after setStyle)
            // We wait for it to be ready before setupLayers
            if (map.isStyleLoaded()) {
                logger.debug('🎨 Style fully loaded, setting up layers...');
                setupLayers(map);
            }
        };

        // Store handlers for persistent cleanup
        handlersRef.current = { onLoad, handleMoveEnd, handleStyleData };

        map.on('load', onLoad);
        map.on('moveend', handleMoveEnd);
        map.on('styledata', handleStyleData);

        // ✅ Setup clustering events via hook (zoomend + moveend for supercluster updates)
        const clusteringCleanup = setupClusteringEvents(map);

        mapRef.current = map;
        return () => {
            if (clusteringCleanup) clusteringCleanup();

            // ✅ Use exact same references for perfect map.off()
            const h = handlersRef.current;
            map.off('load', h.onLoad as any);
            map.off('moveend', h.handleMoveEnd as any);
            map.off('styledata', h.handleStyleData as any);
            
            map.remove();
            mapRef.current = null;
        };
    }, [setupClusteringEvents]); // updateViewport removed from dependencies for stability


    // Sync Données
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        // Mettre à jour les ménages avec les données filtrées/actuelles
        (map.getSource('households') as any)?.setData(householdGeoJSON);
        (map.getSource('grappes') as any)?.setData(grappesGeoJSON);
        (map.getSource('sous-grappes') as any)?.setData(sousGrappesGeoJSON);
        if (grappeZonesData) (map.getSource('auto-grappes') as any)?.setData(grappeZonesData);
        if (grappeCentroidsData) (map.getSource('auto-grappes-centroids') as any)?.setData(grappeCentroidsData);
        if (favoritesGeoJSON) (map.getSource('favorites-source') as any)?.setData(favoritesGeoJSON);

    }, [householdGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, styleIsReady, grappeZonesData, grappeCentroidsData, favoritesGeoJSON]);

    // Sync Map View (Reactivity to center/zoom props)
    // To prevent the map from freezing during drag, we only flyTo if the user isn't interacting
    // AND if the distance is significant enough to mean "the user clicked Recenter".
    // ✅ Command-based view syncing (Programmatic movements)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapCommand) return;

        const { center, zoom } = mapCommand;
        
        logger.debug('🚀 Executing map command:', mapCommand);
        map.flyTo({
            center: toLngLat(center), // Clear explicit conversion [lat, lng] -> [lng, lat]
            zoom: zoom || map.getZoom(),
            duration: 1200,
            essential: true
        });
    }, [mapCommand]);


    // Update active auto-grappe filter
    useEffect(() => {
        const map = mapRef.current;
        // ✅ Enhanced guards: check map exists, style is ready, AND layers exist
        if (!map || !styleIsReady || !map.isStyleLoaded?.()) {
            return;
        }

        try {
            const layersToFilter = ['auto-grappes-fill', 'auto-grappes-outline', 'auto-grappes-labels'];
            const filter = activeGrappeId ? ['==', ['get', 'id'], activeGrappeId] : null;
            
            layersToFilter.forEach(layerId => {
                if (map.getLayer(layerId)) {
                    map.setFilter(layerId, filter as any);
                }
            });
        } catch (err) {
            logger.warn('⚠️ Error setting grappes filters:', err instanceof Error ? err.message : err);
        }
    }, [activeGrappeId, styleIsReady]);

    // ✅ User location marker setup
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        setupUserMarker(map, userLocation);

        return () => { cleanupMarker(); };
    }, [userLocation, setupUserMarker, cleanupMarker]);

    // ✅ Real-time Follow Mode
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !followUser || !userLocation) return;
        
        // Immediate center
        map.flyTo({
            center: userLocation,
            zoom: 17,
            speed: 1.2,
            curve: 1.4,
            essential: true
        });
        
    }, [followUser, userLocation]);

    // Gestion de l'itinéraire OSRM (avec debounce)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        const handleRouting = async () => {
            if (!routingEnabled || !routingStart || !routingDest) {
                if (map.getSource('route-source')) {
                    (map.getSource('route-source') as any)?.setData({ type: 'FeatureCollection', features: [] });
                }
                return;
            }

            setIsRoutingLoading(true);

            try {
                const routeResult = await fetchOSRMRoute({
                    start: routingStart,
                    destination: routingDest
                });

                if (routeResult) {
                    const routeGeoJSON = buildRouteGeoJSON(routeResult.geometry);
                    (map.getSource('route-source') as any).setData(routeGeoJSON);

                    if (onRouteFound) {
                        onRouteFound({
                            distance: routeResult.distance,
                            duration: routeResult.duration,
                            instructions: routeResult.instructions
                        });
                    }
                } else {
                    if (onRouteFound) onRouteFound(null);
                }
            } finally {
                setIsRoutingLoading(false);
            }
        };

        const timer = setTimeout(handleRouting, 300);
        return () => clearTimeout(timer);
    }, [routingEnabled, routingStart, routingDest, styleIsReady, onRouteFound]);

    // Custom UI fit bounds event
    useEffect(() => {
        const handleFitBounds = (e: any) => {
            if (!mapRef.current) return;
            const bbox = e.detail;
            if (bbox && bbox.length === 2 && bbox[0].length === 2 && bbox[1].length === 2) {
                mapRef.current.fitBounds(bbox, { padding: 50, duration: 1000 });
            }
        };

        window.addEventListener('fit-bounds', handleFitBounds);
        return () => window.removeEventListener('fit-bounds', handleFitBounds);
    }, []);

    // ✅ Ruler/Measure tool setup
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;
        const cleanup = setupMeasureTool(map, isMeasuring);
        return cleanup;
    }, [isMeasuring, styleIsReady, setupMeasureTool]);

    // ✅ Consolidated Map Style Switching (Dynamic & Surgical)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        let style = isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
        if (mapStyle === 'satellite') style = MAP_STYLE_SATELLITE;
        
        // Guard: Skip if style is already active to prevent flickering
        // Use a custom property to track the target style accurately
        if ((map as any)._currentStyle === style || (map as any)._targetStyle === style) return;
        (map as any)._targetStyle = style;

        logger.debug('🔄 Switching map style to:', style);
        setStyleIsReady(false);
        
        const handleStyleLoad = () => {
            if (map.isStyleLoaded()) {
                (map as any)._currentStyle = style;
                setStyleIsReady(true);
                map.off('styledata', handleStyleLoad);
                // ✅ Reload layers only once after style change to preserve map state
                // Use ref for setupLayers to avoid re-triggering this effect during rendering
                setupLayersRef.current(map);
                delete (map as any)._targetStyle;
            }
        };
        
        map.on('styledata', handleStyleLoad);
        map.setStyle(style);
        
        return () => {
            if (map) map.off('styledata', handleStyleLoad);
        };
    }, [isDarkMode, mapStyle]); // setupLayers removed from dependencies

    // ✅ Layer visibility setup
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        setupVisibility(map);
    }, [showHeatmap, showZones, styleIsReady, setupVisibility]);

    // Commenting out conflicting flyTo that forces constant recentering
    // useEffect(() => {
    //     if (mapRef.current && styleIsReady) {
    //         mapRef.current.easeTo({ center: [Number(center[1]), Number(center[0])], zoom: zoom || 11, duration: 800 });
    //     }
    // }, [center, zoom, styleIsReady]);

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden bg-black relative">
            {isRoutingLoading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    Calcul de l'itinéraire...
                </div>
            )}
        </div>
    );
}

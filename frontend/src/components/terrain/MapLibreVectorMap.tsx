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
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { getHouseholdDerivedStatus } from '../../utils/statusUtils';

// ── Configuration Visuelle ──
const STATUS_COLOR: Record<string, string> = {
    'Réception: Validée': '#10b981',
    'Terminé': '#10b981',
    'Conforme': '#10b981',
    'Problème': '#f43f5e',
    'Non débuté': '#6366f1',
    'Intérieur': '#818cf8',
    'Réseau': '#3b82f6',
    'Murs': '#f59e0b',
    'Livraison': '#06b6d4'
};

const getStatusColor = (status?: string): string => {
    if (!status) return '#94a3b8';
    const match = Object.entries(STATUS_COLOR).find(([k]) => status.includes(k));
    return match ? match[1] : '#94a3b8';
};

const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const MAP_STYLE_SATELLITE = 'https://tiles.openfreemap.org/styles/bright'; // Simulation for now

const ICON_SVGS = {
    'check': `<path fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/>`,
    'truck': `<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 17h4V5H2v12h3M20 17h2v-9h-4m-2 2h4M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>`,
    'wrench': `<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
    'alert': `<path fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
    'dot': `<circle cx="12" cy="12" r="5" fill="white"/>`
};

const getIconForStatus = (status: string) => {
    if (status.includes('Terminé') || status.includes('Validée') || status.includes('Conforme')) return 'check';
    if (status.includes('Problème')) return 'alert';
    if (status.includes('Livraison')) return 'truck';
    if (status.includes('Murs') || status.includes('Réseau') || status.includes('Intérieur')) return 'wrench';
    return 'dot';
};

const createIconDataURI = (svgContent: string, color: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <g transform="translate(2,2) scale(0.83)">
            ${svgContent}
        </g>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const getIconId = (status: string) => {
    const match = Object.keys(STATUS_COLOR).find(k => status.includes(k));
    return match ? `icon-${match}` : 'icon-default';
};

const loadMapImages = async (map: maplibregl.Map) => {
    const statuses = Object.keys(STATUS_COLOR);
    statuses.push('default');

    await Promise.all(statuses.map(status => {
        return new Promise((resolve) => {
            const color = getStatusColor(status);
            const iconType = getIconForStatus(status);
            const svgContent = ICON_SVGS[iconType as keyof typeof ICON_SVGS] || ICON_SVGS['dot'];
            const dataUri = createIconDataURI(svgContent, color);

            const img = new Image();
            img.onload = () => {
                if (!map.hasImage(`icon-${status}`)) {
                    map.addImage(`icon-${status}`, img);
                }
                resolve(null);
            };
            img.src = dataUri;
        });
    }));
};

export default function MapLibreVectorMap({
    households,
    center,
    zoom,
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
    favorites = []
}: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [styleIsReady, setStyleIsReady] = useState(false);
    const [isRoutingLoading, setIsRoutingLoading] = useState(false);

    // Ruler state
    const measureRef = useRef<[number, number][]>([]);

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

    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { onSelectRef.current = onSelectHousehold; }, [onSelectHousehold]);
    useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);
    useEffect(() => { onDropRef.current = onHouseholdDrop; }, [onHouseholdDrop]);
    useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
    useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
    useEffect(() => { grappesConfigRef.current = grappesConfig; }, [grappesConfig]);
    useEffect(() => { grappeZonesDataRef.current = grappeZonesData; }, [grappeZonesData]);
    useEffect(() => { grappeCentroidsDataRef.current = grappeCentroidsData; }, [grappeCentroidsData]);

    // GéoJSON des Ménages avec correction jitter (décalage spirale pour coordonnées dupliquées)
    const householdGeoJSON = useMemo(() => {
        const valid = (households || []).filter((h: any) =>
            Array.isArray(h.location?.coordinates) &&
            h.location.coordinates.length === 2 &&
            h.location.coordinates[0] != null &&
            h.location.coordinates[1] != null &&
            !isNaN(Number(h.location.coordinates[0])) &&
            !isNaN(Number(h.location.coordinates[1]))
        );

        // Compter les doublons de coordonnées et appliquer un offset spirale
        const coordCount: Record<string, number> = {};
        const JITTER_STEP = 0.00005; // ~5m par step

        return {
            type: 'FeatureCollection',
            features: valid.map((h: any) => {
                let lon = Number(h.location.coordinates[0]);
                let lat = Number(h.location.coordinates[1]);
                const key = `${lon.toFixed(5)}_${lat.toFixed(5)}`;
                const n = coordCount[key] ?? 0;
                coordCount[key] = n + 1;

                if (n > 0) {
                    // Disposition en spirale pour éviter la superposition
                    const angle = (n * 137.5 * Math.PI) / 180; // golden angle
                    const radius = JITTER_STEP * Math.sqrt(n);
                    lon += radius * Math.cos(angle);
                    lat += radius * Math.sin(angle);
                }

                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
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
            await loadMapImages(map);

            if (map.getSource('households')) {
                setupLayersLock.current = false;
                return;
            }

            // --- SOURCES ---
            const martinUrl = import.meta.env.VITE_MARTIN_URL || '';

            // Utiliser le GeoJSON calculé localement au lieu du MVT pour garantir l'affichage 
            // des points (fallback robuste comme demandé)
            map.addSource('households', {
                type: 'geojson',
                data: householdGeoJSON as any,
                cluster: false
            });

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
                    data: favoritesGeoJSON as any
                });
            }

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

            // Source pour l'itinéraire de routage
            if (!map.getSource('route-source')) {
                map.addSource('route-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

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

            // --- LAYERS : AUTO-GRAPPES (Régionalisation) ---
            map.addLayer({
                id: 'auto-grappes-fill',
                type: 'fill',
                source: 'auto-grappes',
                paint: {
                    'fill-color': ['case',
                        ['==', ['get', 'type'], 'dense'], '#10b981', // emerald
                        ['==', ['get', 'type'], 'kmeans'], '#f59e0b', // amber
                        '#3b82f6' // default
                    ],
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false], 0.5,
                        0.2
                    ]
                }
            });

            // Seulement visible si une spécifique est cliquée ou toutes ?
            // On gèrera le filtre dynamiquement dans useEffect (filter: ['==', 'id', activeGrappeId] si pas null)

            map.addLayer({
                id: 'auto-grappes-outline',
                type: 'line',
                source: 'auto-grappes',
                paint: {
                    'line-color': ['case',
                        ['==', ['get', 'type'], 'dense'], '#059669',
                        ['==', ['get', 'type'], 'kmeans'], '#d97706',
                        '#2563eb'
                    ],
                    'line-width': 2,
                    'line-opacity': 0.8
                }
            });

            if (map.getSource('auto-grappes-centroids')) {
                map.addLayer({
                    id: 'auto-grappes-labels',
                    type: 'symbol',
                    source: 'auto-grappes-centroids',
                    layout: {
                        'text-field': ['concat', ['get', 'name'], '\n', ['get', 'count'], ' pts'],
                        'text-size': 12,
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
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

            // --- LAYERS : ZONES (Grappes Manuelles/Anciennes) ---
            map.addLayer({
                id: 'grappes-layer',
                type: 'circle',
                source: 'grappes',
                layout: { visibility: showZones ? 'visible' : 'none' },
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
                    visibility: showZones ? 'visible' : 'none',
                    'text-field': ['get', 'nom'],
                    'text-size': 10,
                    'text-offset': [0, 3],
                    'text-anchor': 'top'
                },
                paint: { 'text-color': '#4f46e5', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            });

            // --- LAYERS : SOUS-GRAPPES ---
            map.addLayer({
                id: 'sous-grappes-layer',
                type: 'circle',
                source: 'sous-grappes',
                layout: { visibility: showZones ? 'visible' : 'none' },
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

            // --- LAYERS : MVT POINTS ---
            map.addLayer({
                id: 'unclustered-points',
                type: 'symbol',
                source: 'households',
                layout: {
                    'icon-image': ['get', 'iconId'],
                    'icon-size': 0.85,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            });

            // Source temporaire pour le drag & drop (visual feedback)
            if (!map.getSource('drag-point')) {
                map.addSource('drag-point', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            map.addLayer({
                id: 'drag-point-layer',
                type: 'circle',
                source: 'drag-point',
                paint: {
                    'circle-radius': 7,
                    'circle-color': '#f59e0b',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            // --- INTERACTIONS ---
            const setupInteraction = (layerId: string) => {
                map.on('mouseenter', layerId, () => {
                    if (!readOnly || layerId === 'clusters' || layerId === 'grappes-layer' || layerId === 'auto-grappes-fill') {
                        map.getCanvas().style.cursor = 'pointer';
                    }
                });
                map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
            };

            ['unclustered-points', 'grappes-layer', 'sous-grappes-layer', 'grappes-labels', 'auto-grappes-fill'].forEach(setupInteraction);

            // Survol Auto-Grappes
            let hoveredAutoGrappeId: string | number | null = null;
            map.on('mousemove', 'auto-grappes-fill', (e) => {
                if (e.features && e.features.length > 0) {
                    if (hoveredAutoGrappeId !== null) {
                        map.setFeatureState(
                            { source: 'auto-grappes', id: hoveredAutoGrappeId },
                            { hover: false }
                        );
                    }
                    hoveredAutoGrappeId = e.features[0].id as string | number;
                    map.setFeatureState(
                        { source: 'auto-grappes', id: hoveredAutoGrappeId },
                        { hover: true }
                    );
                }
            });

            map.on('mouseleave', 'auto-grappes-fill', () => {
                if (hoveredAutoGrappeId !== null) {
                    map.setFeatureState(
                        { source: 'auto-grappes', id: hoveredAutoGrappeId },
                        { hover: false }
                    );
                }
                hoveredAutoGrappeId = null;
            });



            // INTERACTIONS DRAG & DROP
            let isDragging = false;
            let draggedFeatureId: string | null = null;

            map.on('mousedown', 'unclustered-points', (e) => {
                if (readOnly) return;
                const feature = e.features?.[0];
                if (!feature) return;

                // Prevent map panning
                e.preventDefault();
                map.dragPan.disable();
                isDragging = true;
                draggedFeatureId = feature.properties.id;
                map.getCanvas().style.cursor = 'grabbing';
            });

            // Listen on the WHOLE map for drag move, otherwise it drops if mouse moves too fast
            map.on('mousemove', (e) => {
                if (!isDragging || !draggedFeatureId) return;

                // Update temp source for visual feedback
                const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
                if (dragSource) {
                    dragSource.setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                            properties: { id: draggedFeatureId }
                        }]
                    } as any);
                }
            });

            // Listen on the WHOLE map for mouseup
            map.on('mouseup', (e) => {
                if (!isDragging || !draggedFeatureId) {
                    // Safety check to ensure dragPan is re-enabled if stuck
                    if (!map.dragPan.isEnabled()) map.dragPan.enable();
                    return;
                }

                isDragging = false;
                draggedFeatureId = null;
                map.dragPan.enable();
                map.getCanvas().style.cursor = '';

                // Finalize drop
                if (onDropRef.current) {
                    onDropRef.current(draggedFeatureId, e.lngLat.lat, e.lngLat.lng);
                    toast.success("Position mise à jour !");
                }

                // Reset temp source
                const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
                if (dragSource) {
                    dragSource.setData({ type: 'FeatureCollection', features: [] } as any);
                }
            });

            // Clic sur un point -> Sélection
            map.on('click', 'unclustered-points', (e) => {
                const feature = e.features?.[0];
                if (feature) {
                    const h = householdsRef.current.find((item: any) => item.id === feature.properties.id);
                    if (h) onSelectRef.current(h);
                }
            });

            // Clic sur une Zone -> Navigation
            map.on('click', 'grappes-layer', (e) => {
                const feature = e.features?.[0];
                if (feature && onZoneClickRef.current) {
                    const coords = (feature.geometry as any).coordinates;
                    onZoneClickRef.current([coords[1], coords[0]], 14);
                }
            });

            setStyleIsReady(true);
        } finally {
            setupLayersLock.current = false;
        }
    }, [showHeatmap, showZones]); // Reduced deps for setupLayers

    // Initialisation
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
            center: [Number(center[1]), Number(center[0])],
            zoom: zoom || 11,
            localIdeographFontFamily: 'sans-serif'
        });

        const onLoad = () => setupLayers(map);
        map.on('load', onLoad);
        map.on('styledata', onLoad);

        map.on('moveend', () => {
            if (onMoveRef.current) {
                const c = map.getCenter();
                onMoveRef.current([c.lat, c.lng], map.getZoom());
            }
        });

        mapRef.current = map;
        return () => {
            map.off('load', onLoad);
            map.off('styledata', onLoad);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Sync Données
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        (map.getSource('grappes') as any)?.setData(grappesGeoJSON);
        (map.getSource('sous-grappes') as any)?.setData(sousGrappesGeoJSON);

        if (grappeCentroidsData) (map.getSource('auto-grappes-centroids') as any)?.setData(grappeCentroidsData);
        if (favoritesGeoJSON) (map.getSource('favorites-source') as any)?.setData(favoritesGeoJSON);

    }, [householdGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, styleIsReady, grappeZonesData, grappeCentroidsData, favoritesGeoJSON]);

    // Sync Map View (Reactivity to center/zoom props)
    // To prevent the map from freezing during drag, we only flyTo if the user isn't interacting
    // AND if the distance is significant enough to mean "the user clicked Recenter".
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Prevent programmatic flyTo if the user is interacting with the map
        // map.isMoving() is often true during dragPan, but we also check common events
        if (map.isMoving() || map.isZooming() || map.isRotating()) {
            return;
        }

        const currentCenter = map.getCenter();
        const targetLng = Number(center[1]);
        const targetLat = Number(center[0]);

        // Only jump if there's a significant difference (e.g. recenter button clicked)
        // 0.001 represents ~110 meters, enough to ignore slight drag/drift syncs
        const isDifferent = Math.abs(currentCenter.lng - targetLng) > 0.001 ||
            Math.abs(currentCenter.lat - targetLat) > 0.001 ||
            Math.abs(map.getZoom() - (zoom || 11)) > 0.5;

        if (isDifferent) {
            map.flyTo({
                center: [targetLng, targetLat],
                zoom: zoom || map.getZoom(),
                duration: 800, // Smooth transition
                essential: true
            });
        }
    }, [center[0], center[1], zoom]);


    // Update active auto-grappe filter
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        if (activeGrappeId) {
            // Using ['get', 'id'] because activeGrappeId is a string (e.g. "G-1") 
            // and we need to match it against the 'id' property in the GeoJSON/MVT.
            map.setFilter('auto-grappes-fill', ['==', ['get', 'id'], activeGrappeId]);
            map.setFilter('auto-grappes-outline', ['==', ['get', 'id'], activeGrappeId]);
            map.setFilter('auto-grappes-labels', ['==', ['get', 'id'], activeGrappeId]);
        } else {
            map.setFilter('auto-grappes-fill', null);
            map.setFilter('auto-grappes-outline', null);
            map.setFilter('auto-grappes-labels', null);
        }
    }, [activeGrappeId, styleIsReady]);

    // Live User Location Marker
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    useEffect(() => {
        if (!mapRef.current) return;

        if (userLocation && userLocation.length === 2) {
            if (!userMarkerRef.current) {
                const el = document.createElement('div');
                el.className = 'user-location-marker';
                el.innerHTML = `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_0_3px_rgba(59,130,246,0.5)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>`;

                userMarkerRef.current = new maplibregl.Marker({ element: el })
                    .setLngLat([userLocation[1], userLocation[0]]) // MapLibre takes [lon, lat]
                    .addTo(mapRef.current);
            } else {
                userMarkerRef.current.setLngLat([userLocation[1], userLocation[0]]);
            }
        } else {
            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }
        }
    }, [userLocation]);

    // Gestion de l'itinéraire OSRM
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        const fetchRoute = async () => {
            if (!routingEnabled || !routingStart || !routingDest) {
                (map.getSource('route-source') as any)?.setData({ type: 'FeatureCollection', features: [] });
                return;
            }

            const startStr = `${routingStart[1]},${routingStart[0]}`;
            const destStr = `${routingDest[1]},${routingDest[0]}`;

            try {
                setIsRoutingLoading(true);
                const response = await fetch(`http://localhost:5000/route/v1/driving/${startStr};${destStr}?overview=full&geometries=geojson`);
                const data = await response.json();

                if (data.code === 'Ok' && data.routes && data.routes[0]) {
                    const routeGeoJSON = {
                        type: 'Feature',
                        geometry: data.routes[0].geometry,
                        properties: {}
                    };
                    (map.getSource('route-source') as any).setData(routeGeoJSON);

                    // Envoyer les stats (distance en mètres, durée en secondes)
                    if (onRouteFound) {
                        onRouteFound({
                            distance: data.routes[0].distance,
                            duration: data.routes[0].duration
                        });
                    }
                } else {
                    if (onRouteFound) onRouteFound(null);
                }
            } catch (e) {
                console.error("Erreur routage OSRM:", e);
                toast.error("Le service de calcul d'itinéraire est inaccessible.");
                if (onRouteFound) onRouteFound(null);
            } finally {
                setIsRoutingLoading(false);
            }
        };

        // On ne déclenche que si une interaction spécifique est attendue
        fetchRoute();

    }, [routingEnabled, routingStart, routingDest, styleIsReady]);

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

    // Ruler Logic
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;

        const handleMeasureClick = (e: maplibregl.MapMouseEvent) => {
            if (!isMeasuring) return;
            const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            measureRef.current = [...measureRef.current, pt];

            updateMeasureLayer();
        };

        const updateMeasureLayer = () => {
            const geojson: any = {
                type: 'FeatureCollection',
                features: []
            };

            if (measureRef.current.length > 0) {
                geojson.features.push({
                    type: 'Feature',
                    geometry: { type: 'MultiPoint', coordinates: measureRef.current },
                    properties: {}
                });
            }
            if (measureRef.current.length > 1) {
                geojson.features.push({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: measureRef.current },
                    properties: {}
                });
            }

            (map.getSource('measure') as any)?.setData(geojson);
        };

        if (isMeasuring) {
            if (!map.getSource('measure')) {
                map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'measure-line',
                    type: 'line',
                    source: 'measure',
                    paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 1] }
                });
                map.addLayer({
                    id: 'measure-points',
                    type: 'circle',
                    source: 'measure',
                    paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#3b82f6' }
                });
            }
            map.on('click', handleMeasureClick);
            map.getCanvas().style.cursor = 'crosshair';
        } else {
            map.off('click', handleMeasureClick);
            map.getCanvas().style.cursor = '';
            measureRef.current = [];
            (map.getSource('measure') as any)?.setData({ type: 'FeatureCollection', features: [] });
        }

        return () => { map.off('click', handleMeasureClick); };
    }, [isMeasuring, styleIsReady]);

    // Map Style Switching
    useEffect(() => {
        if (mapRef.current) {
            setStyleIsReady(false);
            let style = isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
            if (mapStyle === 'satellite') style = MAP_STYLE_SATELLITE;
            mapRef.current.setStyle(style);
        }
    }, [isDarkMode, mapStyle]);

    // Visibilité
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;
        if (map.getLayer('heatmap')) map.setLayoutProperty('heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
        if (map.getLayer('grappes-layer')) {
            map.setLayoutProperty('grappes-layer', 'visibility', showZones ? 'visible' : 'none');
            map.setLayoutProperty('grappes-labels', 'visibility', showZones ? 'visible' : 'none');
            map.setLayoutProperty('sous-grappes-layer', 'visibility', showZones ? 'visible' : 'none');
        }
    }, [showHeatmap, showZones, styleIsReady]);

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

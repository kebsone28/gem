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
    mapStyle = 'streets'
}: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [styleIsReady, setStyleIsReady] = useState(false);

    // Ruler state
    const measureRef = useRef<[number, number][]>([]);

    // Refs pour éviter les closures périmées (stale closures) dans les event listeners de MapLibre
    const householdsRef = useRef(households);
    const onSelectRef = useRef(onSelectHousehold);
    const onZoneClickRef = useRef(onZoneClick);

    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { onSelectRef.current = onSelectHousehold; }, [onSelectHousehold]);
    useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);

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

    const setupLayers = useCallback(async (map: maplibregl.Map) => {
        if (!map) return;

        await loadMapImages(map);

        if (map.getSource('households')) return;

        // --- SOURCES ---
        map.addSource('households', {
            type: 'geojson',
            data: householdGeoJSON as any,
            cluster: true,
            clusterRadius: 50,
            clusterMaxZoom: 15
        });

        // Source non-clusterisée pour la heatmap (cluster: true supprime les points individuels)
        map.addSource('households-raw', {
            type: 'geojson',
            data: householdGeoJSON as any
        });

        map.addSource('grappes', { type: 'geojson', data: grappesGeoJSON as any });
        map.addSource('sous-grappes', { type: 'geojson', data: sousGrappesGeoJSON as any });

        // --- LAYERS : ZONES (Grappes) ---
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

        // --- LAYERS : HOUSEHOLDS (Heatmap) — utilise la source RAW non-clusterisée ---
        map.addLayer({
            id: 'heatmap',
            type: 'heatmap',
            source: 'households-raw',   // ← source sans cluster
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

        // --- LAYERS : CLUSTERS ---
        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'households',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], '#6366f1', 100, '#4f46e5', 500, '#4338ca'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 500, 40],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#fff'
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'households',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 12,
                'text-allow-overlap': true
            },
            paint: { 'text-color': '#fff' }
        });

        // --- LAYERS : POINTS ---
        map.addLayer({
            id: 'unclustered-points',
            type: 'symbol',
            source: 'households',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': ['get', 'iconId'],
                'icon-size': 0.8,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            }
        });

        // --- INTERACTIONS ---
        const setupInteraction = (layerId: string) => {
            map.on('mouseenter', layerId, () => {
                if (!readOnly || layerId === 'clusters' || layerId === 'grappes-layer') {
                    map.getCanvas().style.cursor = 'pointer';
                }
            });
            map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
        };

        ['clusters', 'unclustered-points', 'grappes-layer', 'sous-grappes-layer', 'grappes-labels'].forEach(setupInteraction);

        // Clic sur un cluster -> Zoom
        map.on('click', 'clusters', async (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            const clusterId = features[0].properties.cluster_id;
            const source = map.getSource('households') as maplibregl.GeoJSONSource;
            const expansionZoom = await (source as any).getClusterExpansionZoom(clusterId);
            map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: expansionZoom });
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
    }, [householdGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, showHeatmap, showZones, households, onSelectHousehold, onZoneClick]);

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

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Sync Données
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleIsReady) return;
        (map.getSource('households') as any)?.setData(householdGeoJSON);
        (map.getSource('households-raw') as any)?.setData(householdGeoJSON); // pour la heatmap
        (map.getSource('grappes') as any)?.setData(grappesGeoJSON);
        (map.getSource('sous-grappes') as any)?.setData(sousGrappesGeoJSON);
    }, [householdGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, styleIsReady]);

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

    // Flyto
    useEffect(() => {
        if (mapRef.current && styleIsReady) {
            mapRef.current.easeTo({ center: [Number(center[1]), Number(center[0])], zoom: zoom || 11, duration: 800 });
        }
    }, [center, zoom, styleIsReady]);

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden bg-black" />
    );
}

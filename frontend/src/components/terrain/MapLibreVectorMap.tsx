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

export default function MapLibreVectorMap({
    households,
    center,
    zoom,
    isDarkMode,
    onSelectHousehold,
    showHeatmap = false,
    showZones = false,
    onZoneClick,
    grappesConfig
}: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [styleIsReady, setStyleIsReady] = useState(false);

    // Refs pour éviter les closures périmées (stale closures) dans les event listeners de MapLibre
    const householdsRef = useRef(households);
    const onSelectRef = useRef(onSelectHousehold);
    const onZoneClickRef = useRef(onZoneClick);

    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { onSelectRef.current = onSelectHousehold; }, [onSelectHousehold]);
    useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);

    // GéoJSON des Ménages
    const householdGeoJSON = useMemo(() => ({
        type: 'FeatureCollection',
        features: (households || [])
            .filter((h: any) =>
                Array.isArray(h.location?.coordinates) &&
                h.location.coordinates.length === 2 &&
                h.location.coordinates[0] != null &&
                h.location.coordinates[1] != null &&
                !isNaN(Number(h.location.coordinates[0])) &&
                !isNaN(Number(h.location.coordinates[1]))
            )
            .map((h: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [Number(h.location.coordinates[0]), Number(h.location.coordinates[1])]
                },
                properties: {
                    id: h.id,
                    status: getHouseholdDerivedStatus(h),
                    color: getStatusColor(getHouseholdDerivedStatus(h))
                }
            }))
    }), [households]);

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

    const setupLayers = useCallback((map: maplibregl.Map) => {
        if (!map || map.getSource('households')) return;

        // --- SOURCES ---
        map.addSource('households', {
            type: 'geojson',
            data: householdGeoJSON as any,
            cluster: true,
            clusterRadius: 50,
            clusterMaxZoom: 15
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

        // --- LAYERS : HOUSEHOLDS (Heatmap) ---
        map.addLayer({
            id: 'heatmap',
            type: 'heatmap',
            source: 'households',
            layout: { visibility: showHeatmap ? 'visible' : 'none' },
            paint: {
                'heatmap-opacity': 0.6,
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)', 0.2, 'rgba(99,102,241,0.2)', 0.5, 'rgba(239,68,68,0.5)', 1, 'rgba(239,68,68,1)'
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
            type: 'circle',
            source: 'households',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['get', 'color'],
                'circle-radius': 9,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#fff'
            }
        });

        // --- INTERACTIONS ---
        const setupInteraction = (layerId: string) => {
            map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
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
        (map.getSource('grappes') as any)?.setData(grappesGeoJSON);
        (map.getSource('sous-grappes') as any)?.setData(sousGrappesGeoJSON);
    }, [householdGeoJSON, grappesGeoJSON, sousGrappesGeoJSON, styleIsReady]);

    // Thème
    useEffect(() => {
        if (mapRef.current) {
            setStyleIsReady(false);
            mapRef.current.setStyle(isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);
        }
    }, [isDarkMode]);

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
        <div ref={containerRef} className="w-full h-full rounded-[2rem] overflow-hidden bg-black" />
    );
}

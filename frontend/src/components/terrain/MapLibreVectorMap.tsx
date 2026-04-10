import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ✅ Optimize worker threads for terrain use
maplibregl.setWorkerCount(2);

import {
    MAP_STYLE_DARK,
    MAP_STYLE_LIGHT_VECTOR, MAP_STYLE_SATELLITE
} from './mapConfig';
import { useMapInteractions } from './useMapInteractions';
import { useMapClustering } from './useMapClustering';
import { useMemorizedSupercluster } from './useMemorizedSupercluster';
import { useMapMarkers } from './useMapMarkers';
import { useMapMeasure } from './useMapMeasure';
import { useMapLasso } from './useMapLasso';
import { useTerrainUIStore } from '../../store/terrainUIStore';
import { useTheme } from '../../contexts/ThemeContext';
import { globalSingletonMap } from '../../services/map/MapSingleton';
import { registerTileCacheProtocol } from '../../services/map/tileCacheService';
import { useViewportLoading } from '../../hooks/useViewportLoading';

// Import Modular Layers
import BackgroundLayer from './layers/BackgroundLayer';
import HouseholdLayer from './layers/HouseholdLayer';
import ZoneLayer from './layers/ZoneLayer';
import LogisticsLayer from './layers/LogisticsLayer';
import InteractionLayer from './layers/InteractionLayer';
import MapTooltip from './MapTooltip';

registerTileCacheProtocol();

const toLatLng = (coords: [number, number]): [number, number] => {
    if (coords[0] < 0 && coords[1] > 0) return [coords[1], coords[0]];
    return coords;
};

const sameHouseholdIds = (a: any[], b: any[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id) return false;
    }
    return true;
};

const MapLibreVectorMap: React.FC<any> = ({
    households,
    selectedHouseholdId,
    mapCommand,
    onZoneClick,
    // grappesConfig, // Omitted to fix unused warning
    readOnly = false,
    grappeZonesData,
    grappeCentroidsData,
    userLocation,
    onHouseholdDrop,
    onMove,
    onBoundsChange,
    projectId,
    warehouses = [],
    onLassoSelection,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const hasInitialized = useRef(false);
    const [styleIsReady, setStyleIsReady] = useState(false);
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

    const showHeatmap = useTerrainUIStore(s => s.showHeatmap);
    const showZones = useTerrainUIStore(s => s.showZones);
    const isSelecting = useTerrainUIStore(s => s.isSelecting);
    const mapStyle = useTerrainUIStore(s => s.mapStyle);
    const { isDarkMode } = useTheme();

    // ── Interactive State (Tooltips) ──
    const [hoverData, setHoverData] = useState<any>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

    // Refs pour éviter les closures périmées
    const householdsRef = useRef(households);
    const onZoneClickRef = useRef(onZoneClick);
    const onDropRef = useRef(onHouseholdDrop);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const onMoveRef = useRef(onMove);

    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);
    useEffect(() => { onDropRef.current = onHouseholdDrop; }, [onHouseholdDrop]);
    useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
    useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

    // ── VIEWPORT LOADING ──
    // ❌ Désactivé : peut tromper l'utilisateur en ne montrant que les ménages visibles
    // On garde le chargement complet de tous les ménages pour une vue d'ensemble fidèle
    const { visibleHouseholds, isLoadingViewport, updateViewport } = useViewportLoading({
        enabled: false, // Désactivé pour éviter la confusion utilisateur
        projectId,
        debounceMs: 300,
        onHouseholdsLoaded: (loadedHouseholds) => {
            logger.debug(`📍 Viewport loaded ${loadedHouseholds.length} households`);
        }
    });

    // ✅ Utiliser TOUS les ménages chargés pour une vue complète et fidèle
    const activeHouseholds = households;

    // Workers & supercluster
    const superclusterRef = useMemorizedSupercluster(activeHouseholds);
    const geoJsonWorker = useMemo(() => new Worker(new URL('../../workers/mapGeoJsonWorker.ts', import.meta.url), { type: 'module' }), []);
    const selectedHousehold = React.useMemo(() => {
        if (!selectedHouseholdId) return null;
        return households?.find((h: any) => h.id === selectedHouseholdId) || null;
    }, [households, selectedHouseholdId]);

    const selectedHouseholdCoords: [number, number] | null = selectedHousehold?.location?.coordinates || null;
    const [householdGeoJSON, setHouseholdGeoJSON] = useState<any>(null);

    // ✅ Sync GeoJSON via worker with debouncing and smart diffing
    const geoJsonDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const prevHouseholdsRef = useRef<any[]>([]);

    useEffect(() => {
        if (!activeHouseholds || activeHouseholds.length === 0) {
            setHouseholdGeoJSON({ type: 'FeatureCollection', features: [] });
            return;
        }

        // Skip if households are essentially the same
        if (sameHouseholdIds(prevHouseholdsRef.current, activeHouseholds)) {
            return;
        }

        // Debounce the worker call
        if (geoJsonDebounceRef.current) {
            clearTimeout(geoJsonDebounceRef.current);
        }

        geoJsonDebounceRef.current = setTimeout(() => {
            geoJsonWorker.onmessage = (e) => {
                if (e.data.type === 'GEOJSON_RESULT') {
                    setHouseholdGeoJSON(e.data.data);
                    prevHouseholdsRef.current = [...activeHouseholds]; // Update prev after successful processing
                }
            };
            geoJsonWorker.postMessage({ households: activeHouseholds });
        }, 150);

        return () => {
            if (geoJsonDebounceRef.current) {
                clearTimeout(geoJsonDebounceRef.current);
            }
        };
    }, [activeHouseholds, geoJsonWorker]);

    useEffect(() => { return () => geoJsonWorker.terminate(); }, [geoJsonWorker]);

    // Hooks
    const { setupInteractions } = useMapInteractions(readOnly, householdsRef, onZoneClickRef, onDropRef);
    const { setupClusteringEvents, updateClusterDisplay } = useMapClustering(superclusterRef);
    const { setupUserMarker, cleanup: cleanupMarkers } = useMapMarkers(userLocation);
    const { setupMeasureTool } = useMapMeasure();
    const { setupLasso } = useMapLasso(isSelecting, householdsRef, onLassoSelection);

    // ── INITIALIZATION ──
    useEffect(() => {
        if (!containerRef.current || hasInitialized.current) return;

        let isMounted = true;

        const initGlobalMap = async () => {
            const { map, container } = await globalSingletonMap.getMap(isDarkMode);
            if (!isMounted) return;

            hasInitialized.current = true;

            // 🔄 Emboîter le Singleton dans le composant React (DOM Injection)
            containerRef.current!.appendChild(container);
            map.resize(); // Force recalculation des marges

            mapRef.current = map;
            setMapInstance(map);
            setStyleIsReady(!!map.isStyleLoaded());

            // ✅ TOOLTIP HOVER HANDLERS
            const handleMouseMove = (e: any) => {
                if (!map.isStyleLoaded()) return;
                try {
                    const existingStyle = map.getStyle();
                    const targetLayers = ['households-local-layer', 'households-server-layer', 'supercluster-generated']
                        .filter(id => existingStyle.layers?.some((l: any) => l.id === id));

                    if (targetLayers.length === 0) return;

                    const features = map.queryRenderedFeatures(e.point, { layers: targetLayers });

                    if (features.length > 0) {
                        map.getCanvas().style.cursor = 'pointer';
                        const f = features[0];
                        setHoverData(f.properties);
                        setHoverPos({ x: e.point.x, y: e.point.y });
                    } else {
                        map.getCanvas().style.cursor = '';
                        setHoverData(null);
                        setHoverPos(null);
                    }
                } catch (err: any) {
                    console.debug('Map query skipping:', err.message);
                }
            };

            const handleMouseLeave = () => {
                setHoverData(null);
                setHoverPos(null);
            };

            const handleStyleLoad = () => setStyleIsReady(true);
            const handleMove = () => {
                if (onMoveRef.current) {
                    const center = map.getCenter();
                    onMoveRef.current(toLatLng([center.lng, center.lat]), map.getZoom());
                }
            };
            const handleMoveEnd = () => {
                // Notifier Terrain.tsx des nouvelles bornes (filtre local)
                onBoundsChangeRef.current?.(map.getBounds().toArray().flat() as any);
            };

            map.on('mousemove', handleMouseMove);
            map.on('mouseleave', handleMouseLeave);
            map.on('style.load', handleStyleLoad);
            map.on('move', handleMove);
            map.on('moveend', handleMoveEnd);

            return () => {
                map.off('mousemove', handleMouseMove);
                map.off('mouseleave', handleMouseLeave);
                map.off('style.load', handleStyleLoad);
                map.off('move', handleMove);
                map.off('moveend', handleMoveEnd);

                if (container.parentNode === containerRef.current) {
                    containerRef.current?.removeChild(container);
                }
                mapRef.current = null;
            };
        };

        const cleanupPromise = initGlobalMap();

        return () => {
            isMounted = false;
            cleanupMarkers();

            // Le cleanup doit retirer les Listeners et détacher le DIV sans détruire le Worker
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, []);

    const lastTargetSourceRef = useRef<string | null>(null);

    // ✅ Unified Style switcher (via Singleton)
    useEffect(() => {
        if (!mapInstance || (mapInstance as any)._removed) return;

        const targetSource = mapStyle; // 'light', 'dark', or 'satellite'

        if (lastTargetSourceRef.current === targetSource) return;

        console.log(`[Terrain] 🚀 Singleton switching style to: ${targetSource}`);
        lastTargetSourceRef.current = targetSource;
        setStyleIsReady(false);

        globalSingletonMap.switchStyle(targetSource, isDarkMode).then(() => {
            setStyleIsReady(true);
        });
    }, [mapStyle, isDarkMode, mapInstance]);

    // ✅ Commands handler
    useEffect(() => {
        if (!mapRef.current || !mapCommand || !styleIsReady) return;
        const { center, zoom, bounds } = mapCommand;
        if (bounds) {
            mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 18 });
        } else if (center) {
            mapRef.current.flyTo({ center, zoom: zoom || mapRef.current.getZoom(), duration: 2000, essential: true });
        }
    }, [mapCommand, styleIsReady]);

    const initializedToolsRef = useRef<string | null>(null);

    // ✅ Legacy Tools Initialization
    useEffect(() => {
        if (!mapInstance || !styleIsReady || !mapInstance.isStyleLoaded()) return;

        // Token for double-init prevention (style + geojson features count + projectId)
        const initToken = `${lastTargetSourceRef.current}-${householdGeoJSON?.features?.length || 0}-${projectId}`;
        if (initializedToolsRef.current === initToken) return;
        initializedToolsRef.current = initToken;

        console.log(`[Terrain] 🛠️ Initializing map tools (${initToken})...`);
        try {
            setupInteractions(mapInstance);
            setupClusteringEvents(mapInstance);
            setupUserMarker(mapInstance, userLocation);
            setupMeasureTool(mapInstance, false); // Initial state
            setupLasso(mapInstance);
        } catch (e) {
            console.error("[Terrain] ❌ Failed to initialize tools:", e);
        }
    }, [mapInstance, styleIsReady, setupInteractions, setupClusteringEvents, setupUserMarker, setupMeasureTool, setupLasso, userLocation, households]);

    // Force cluster update when households change (OR style reload)
    useEffect(() => {
        if (mapInstance && styleIsReady && households.length > 0) {
            updateClusterDisplay(mapInstance, true); // ✅ Force update on style change/data sync
        }
    }, [households, mapInstance, styleIsReady, updateClusterDisplay]);

    return (
        <div ref={containerRef} className="w-full h-full relative outline-none bg-slate-900 overflow-hidden">
            {/* Modular Layers */}
            <BackgroundLayer map={mapInstance} />

            <HouseholdLayer
                map={mapInstance}
                householdGeoJSON={householdGeoJSON}
                households={activeHouseholds}
                projectId={projectId}
                selectedHouseholdCoords={selectedHouseholdCoords}
                showHeatmap={showHeatmap}
                styleIsReady={styleIsReady}
            />
            <ZoneLayer
                map={mapInstance}
                styleIsReady={styleIsReady}
                grappeZonesData={grappeZonesData}
                grappeCentroidsData={grappeCentroidsData}
                showZones={showZones}
            />

            <LogisticsLayer
                map={mapInstance}
                styleIsReady={styleIsReady}
                warehouses={warehouses}
            />

            <InteractionLayer
                map={mapInstance}
                styleIsReady={styleIsReady}
                drawnZones={[]}
                pendingPoints={[]}
            />

            {/* PREMIUN HOVER TOOLTIP */}
            {hoverData && hoverPos && (
                <MapTooltip data={hoverData} x={hoverPos.x} y={hoverPos.y} />
            )}
        </div>
    );
};

export default React.memo(MapLibreVectorMap);

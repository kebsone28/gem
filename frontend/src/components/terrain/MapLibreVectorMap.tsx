import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ✅ Optimize worker threads for terrain use
maplibregl.setWorkerCount(2);

import { useMapInteractions } from './useMapInteractions';
import { useMapClustering } from './useMapClustering';
import { useMapMarkers } from './useMapMarkers';
import { useMapMeasure } from './useMapMeasure';
import { useMapLasso } from './useMapLasso';
import { useTerrainUIStore } from '../../store/terrainUIStore';
import { useTheme } from '../../contexts/ThemeContext';
import { globalSingletonMap } from '../../services/map/MapSingleton';
import { registerTileCacheProtocol } from '../../services/map/tileCacheService';
import { useViewportLoading } from '../../hooks/useViewportLoading';
import logger from '../../utils/logger';

// Import Modular Layers
import BackgroundLayer from './layers/BackgroundLayer';
import HouseholdLayer from './layers/HouseholdLayer';
import ZoneLayer from './layers/ZoneLayer';
import LogisticsLayer from './layers/LogisticsLayer';
import InteractionLayer from './layers/InteractionLayer';
import MapTooltip from './MapTooltip';
import { useSuperclusterWorker } from '../../hooks/useSuperclusterWorker';
import { householdsToGeoJSON } from '../../utils/clusteringUtils';
import { registerIcons } from './mapUtils';

registerTileCacheProtocol();

const toLatLng = (coords: [number, number]): [number, number] => {
  if (coords[0] < 0 && coords[1] > 0) return [coords[1], coords[0]];
  return coords;
};

// Fast hash to detect changes deeply without iterating over every ID on every render
const computeHouseholdHash = (households: any[]) => {
  if (!households || households.length === 0) return 'empty';
  // Use length and sum of versions as a fast proxy for dataset changes
  let versionSum = 0;
  for (let i = 0; i < households.length; i++) {
    versionSum += households[i].version || 0;
  }
  return `len:${households.length}-vsum:${versionSum}`;
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
  drawnZones = [],
  pendingPoints = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasInitialized = useRef(false);
  const [styleIsReady, setStyleIsReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  const showHeatmap = useTerrainUIStore((s) => s.showHeatmap);
  const showZones = useTerrainUIStore((s) => s.showZones);
  const isSelecting = useTerrainUIStore((s) => s.isSelecting);
  const isMeasuring = useTerrainUIStore((s) => s.isMeasuring);
  const mapStyle = useTerrainUIStore((s) => s.mapStyle);
  const { isDarkMode } = useTheme();

  // ── Interactive State (Tooltips) ──
  const [hoverData, setHoverData] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Refs pour éviter les closures périmées
  const householdsRef = useRef(households);
  const onZoneClickRef = useRef(onZoneClick);
  const onDropRef = useRef(onHouseholdDrop);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    householdsRef.current = households;
  }, [households]);
  useEffect(() => {
    onZoneClickRef.current = onZoneClick;
  }, [onZoneClick]);
  useEffect(() => {
    onDropRef.current = onHouseholdDrop;
  }, [onHouseholdDrop]);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);
  const activeHouseholds = households;

  // Workers & supercluster
  const clusterWorker = useSuperclusterWorker();

  // Load points into worker when households change
  useEffect(() => {
    if (activeHouseholds && activeHouseholds.length > 0) {
      const geoJSON = householdsToGeoJSON(activeHouseholds);
      clusterWorker.loadPoints(geoJSON);
    }
  }, [activeHouseholds, clusterWorker]);
  const geoJsonWorker = useMemo(
    () =>
      new Worker(new URL('../../workers/mapGeoJsonWorker.ts', import.meta.url), { type: 'module' }),
    []
  );
  const selectedHousehold = React.useMemo(() => {
    if (!selectedHouseholdId) return null;
    return households?.find((h: any) => h.id === selectedHouseholdId) || null;
  }, [households, selectedHouseholdId]);

  const selectedHouseholdCoords: [number, number] | null = React.useMemo(() => {
    if (!selectedHousehold) return null;
    const lng = Number(selectedHousehold.location?.coordinates?.[0] ?? selectedHousehold.longitude);
    const lat = Number(selectedHousehold.location?.coordinates?.[1] ?? selectedHousehold.latitude);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }, [selectedHousehold]);
  const [householdGeoJSON, setHouseholdGeoJSON] = useState<any>(null);

  // ✅ Sync GeoJSON via worker with debouncing and smart diffing
  const geoJsonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevHashRef = useRef<string>('');

  useEffect(() => {
    if (!activeHouseholds || activeHouseholds.length === 0) {
      setHouseholdGeoJSON({ type: 'FeatureCollection', features: [] });
      return;
    }

    const currentHash = computeHouseholdHash(activeHouseholds);
    // Skip if households are essentially the same
    if (prevHashRef.current === currentHash) {
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
          prevHashRef.current = currentHash; // Update prev hash after successful processing
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

  useEffect(() => {
    return () => geoJsonWorker.terminate();
  }, [geoJsonWorker]);

  // Hooks
  const { setupInteractions } = useMapInteractions(
    readOnly,
    householdsRef,
    onZoneClickRef,
    onDropRef
  );
  const { setupClusteringEvents, updateClusterDisplay } = useMapClustering(clusterWorker);
  const { setupUserMarker, cleanup: cleanupMarkers } = useMapMarkers(userLocation);
  const { setupMeasureTool } = useMapMeasure();
  const { setupLasso } = useMapLasso(isSelecting, householdsRef, onLassoSelection);
  
  // ✅ INITIALIZATION (DOM + Basic Listeners)
  useEffect(() => {
    if (!containerRef.current || hasInitialized.current) return;
    let isMounted = true;

    const initGlobalMap = async () => {
      const { map, container } = await globalSingletonMap.getMap(isDarkMode);
      if (!isMounted) return;

      hasInitialized.current = true;
      containerRef.current!.appendChild(container);
      map.resize();

      mapRef.current = map;
      setMapInstance(map);
      
      const checkAndLoad = async () => {
        if (map.isStyleLoaded()) {
          setStyleIsReady(true);
          await registerIcons(map);
          setIconsReady(true);
        }
      };

      const handleStyleLoad = async () => {
        setStyleIsReady(true);
        setIconsReady(false); // Reset while loading new icons
        await registerIcons(map);
        setIconsReady(true);
      };

      const handleMouseMove = (e: any) => {
        if (!map.isStyleLoaded() || !iconsReady) return;
        try {
          const existingStyle = map.getStyle();
          const targetLayers = [
            'households-local-layer',
            'households-glow-layer',
          ].filter((id) => existingStyle.layers?.some((l: any) => l.id === id));

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

      const handleMove = () => {
        if (onMoveRef.current) {
          const center = map.getCenter();
          onMoveRef.current(toLatLng([center.lng, center.lat]), map.getZoom());
        }
      };
      const handleMoveEnd = () => {
        onBoundsChangeRef.current?.(map.getBounds().toArray().flat() as any);
      };

      map.on('mousemove', handleMouseMove);
      map.on('mouseleave', handleMouseLeave);
      map.on('move', handleMove);
      map.on('moveend', handleMoveEnd);
      map.on('style.load', handleStyleLoad);
      
      checkAndLoad();

      return () => {
        map.off('mousemove', handleMouseMove);
        map.off('mouseleave', handleMouseLeave);
        map.off('move', handleMove);
        map.off('moveend', handleMoveEnd);
        map.off('style.load', handleStyleLoad);
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
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  const lastTargetSourceRef = useRef<string | null>(null);

  // ✅ Unified Style switcher (via Singleton)
  useEffect(() => {
    if (!mapInstance || (mapInstance as any)._removed) return;

    const targetSource = mapStyle;
    if (lastTargetSourceRef.current === targetSource) return;

    console.log(`[Terrain] 🚀 Singleton switching style to: ${targetSource}`);
    lastTargetSourceRef.current = targetSource;
    
    // Lock layers until new style AND new icons are ready
    setStyleIsReady(false);
    setIconsReady(false);

    globalSingletonMap.switchStyle(targetSource, isDarkMode).then(async () => {
      setStyleIsReady(true);
      await registerIcons(mapInstance);
      setIconsReady(true);
    });
  }, [mapStyle, isDarkMode, mapInstance]);

  // ✅ Commands handler
  useEffect(() => {
    if (!mapRef.current || !mapCommand || !styleIsReady) return;
    const { center, zoom, bounds } = mapCommand;
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 18 });
    } else if (center) {
      mapRef.current.flyTo({
        center,
        zoom: zoom || mapRef.current.getZoom(),
        duration: 2000,
        essential: true,
      });
    }
  }, [mapCommand, styleIsReady]);

  const initializedToolsRef = useRef<string | null>(null);

  // ✅ Baseline Tools Initialization (One-time or on style change)
  useEffect(() => {
    if (!mapInstance || !styleIsReady || !iconsReady || !mapInstance.isStyleLoaded()) return;

    // Token for double-init prevention (style + features + projectId)
    const initToken = `${lastTargetSourceRef.current}-${householdGeoJSON?.features?.length || 0}-${projectId}`;
    if (initializedToolsRef.current === initToken) return;
    initializedToolsRef.current = initToken;

    console.log(`[Terrain] 🛠️ Initializing map baseline tools (${initToken})...`);
    try {
      setupInteractions(mapInstance);
      setupClusteringEvents(mapInstance);
      setupUserMarker(mapInstance, userLocation);
    } catch (e) {
      console.error('[Terrain] ❌ Failed to initialize baseline tools:', e);
    }
  }, [
    mapInstance,
    styleIsReady,
    setupInteractions,
    setupClusteringEvents,
    setupUserMarker,
    userLocation,
    projectId,
    householdGeoJSON?.features?.length
  ]);

  // ✅ REACTIVE TOOL: RULER (Mesure)
  useEffect(() => {
    if (!mapInstance || !styleIsReady || !iconsReady) return;
    const cleanup = setupMeasureTool(mapInstance, isMeasuring);
    return () => cleanup && cleanup();
  }, [mapInstance, styleIsReady, iconsReady, isMeasuring, setupMeasureTool]);

  // ✅ REACTIVE TOOL: LASSO (Sélection)
  useEffect(() => {
    if (!mapInstance || !styleIsReady || !iconsReady) return;
    const cleanup = setupLasso(mapInstance);
    return () => cleanup && cleanup();
  }, [mapInstance, styleIsReady, iconsReady, isSelecting, setupLasso]);


  // 🎥 Cinematic 3D Immersion: Progressive Pitch on Zoom
  useEffect(() => {
    if (!mapInstance) return;

    const handleZoom = () => {
      const zoom = mapInstance.getZoom();
      const minZ = 14;
      const maxZ = 17;
      const maxPitch = 45;

      if (zoom <= minZ) {
        if (mapInstance.getPitch() !== 0) mapInstance.setPitch(0);
      } else if (zoom >= maxZ) {
        if (mapInstance.getPitch() !== maxPitch) mapInstance.setPitch(maxPitch);
      } else {
        // Interpolation linéaire pour l'effet "Caméra Drone"
        const progress = (zoom - minZ) / (maxZ - minZ);
        mapInstance.setPitch(progress * maxPitch);
      }
    };

    mapInstance.on('zoom', handleZoom);
    return () => {
      mapInstance.off('zoom', handleZoom);
    };
  }, [mapInstance]);

  // Force cluster update when households change (OR style reload OR zone toggle)
  useEffect(() => {
    if (mapInstance && styleIsReady) {
      if (showZones) {
        // Force clear generic clusters
        const clusterSource = mapInstance.getSource('supercluster-generated') as any;
        if (clusterSource?.setData) clusterSource.setData({ type: 'FeatureCollection', features: [] });
        const hullSource = mapInstance.getSource('cluster-hulls') as any;
        if (hullSource?.setData) hullSource.setData({ type: 'FeatureCollection', features: [] });
      } else {
        updateClusterDisplay(mapInstance, true);
      }
    }
  }, [households, mapInstance, styleIsReady, updateClusterDisplay, showZones]);

  // ── 9. LAYER VISIBILITY HARMONIZATION ──
  // Si on affiche les Zones (Villages), on cache les grappes circulaires standard
  useEffect(() => {
    if (!mapInstance || !styleIsReady) return;
    
    const clusterLayers = ['cluster-halo', 'cluster-circles', 'cluster-counts'];
    const pointLayers = [
      'households-local-layer', 
      'households-glow-layer', 
      'households-symbol-layer',
      'households-labels-simple',
      'households-photo-badge'
    ];
    
    clusterLayers.forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        // Mode zones : on masque les grappes génériques (cercles/chiffres)
        mapInstance.setLayoutProperty(layerId, 'visibility', showZones ? 'none' : 'visible');
      }
    });

    pointLayers.forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        // On GARDE les ménages visibles
        mapInstance.setLayoutProperty(layerId, 'visibility', 'visible');
        
        // MAIS on réduit drastiquement l'effet "cercle" (halo) pour ne pas polluer les trapèzes
        if (layerId === 'households-glow-layer') {
          mapInstance.setPaintProperty(layerId, 'circle-opacity', showZones ? 0.2 : 0.85);
          mapInstance.setPaintProperty(layerId, 'circle-stroke-width', showZones ? 0 : 1.5);
          mapInstance.setPaintProperty(layerId, 'circle-radius', showZones ? 2 : 6);
        }
      }
    });

    // ── NOUVEAU : On s'assure que les Grappes Proximité (Hulls) sont affichées
    const superclusterHulls = ['supercluster-hulls-fill', 'supercluster-hulls-outline'];
    superclusterHulls.forEach(id => {
      if (mapInstance.getLayer(id)) {
        mapInstance.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
      }
    });
  }, [mapInstance, styleIsReady, showZones]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative outline-none bg-slate-900 overflow-hidden"
    >
      {/* Modular Layers */}
      <BackgroundLayer map={mapInstance} />

      <HouseholdLayer
        map={mapInstance}
        householdGeoJSON={householdGeoJSON}
        households={activeHouseholds}
        projectId={projectId}
        selectedHouseholdCoords={selectedHouseholdCoords}
        showHeatmap={showHeatmap}
        styleIsReady={styleIsReady && iconsReady}
      />
      <ZoneLayer
        map={mapInstance}
        styleIsReady={styleIsReady}
        grappeZonesData={grappeZonesData}
        grappeCentroidsData={grappeCentroidsData}
        showZones={showZones}
      />

      <LogisticsLayer map={mapInstance} styleIsReady={styleIsReady} warehouses={warehouses} />

      <InteractionLayer
        map={mapInstance}
        styleIsReady={styleIsReady}
        drawnZones={drawnZones}
        pendingPoints={pendingPoints}
      />

      {/* PREMIUN HOVER TOOLTIP */}
      {hoverData && hoverPos && <MapTooltip data={hoverData} x={hoverPos.x} y={hoverPos.y} />}
    </div>
  );
};

export default React.memo(MapLibreVectorMap);

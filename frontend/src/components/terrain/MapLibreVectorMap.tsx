/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';

// ✅ Optimize worker threads for terrain use
maplibregl.setWorkerCount(2);

import { useMapInteractions } from './useMapInteractions';
import { useMapClustering } from './useMapClustering';
import { useMapMarkers } from './useMapMarkers';
import { useMapMeasure } from './useMapMeasure';
import { useMapLasso } from './useMapLasso';
import { useTerrainUIStore } from '../../store/terrainUIStore';
import { useTheme } from '../../contexts/ThemeContext';
import { registerTileCacheProtocol } from '../../services/map/tileCacheService';
import { useViewportLoading } from '../../hooks/useViewportLoading';
import logger from '../../utils/logger';
import * as safeStorage from '../../utils/safeStorage';
import {
  MAP_STYLE_DARK,
  MAP_STYLE_FALLBACK_RASTER,
  MAP_STYLE_LIGHT_VECTOR,
  MAP_STYLE_SATELLITE,
} from './mapConfig';

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

const safeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const resolveMapStyle = (
  style: 'dark' | 'light' | 'satellite',
  isDarkMode: boolean
) => {
  if (style === 'satellite') {
    return { ...MAP_STYLE_SATELLITE, metadata: { source: 'satellite' } };
  }

  if (style === 'light') return MAP_STYLE_LIGHT_VECTOR;
  if (style === 'dark') return MAP_STYLE_DARK;
  return isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT_VECTOR;
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const hasInitialized = useRef(false);
  const isDestroyingRef = useRef(false);
  const [styleIsReady, setStyleIsReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  const showHeatmap = useTerrainUIStore((s) => s.showHeatmap);
  const showZones = useTerrainUIStore((s) => s.showZones);
  const isSelecting = useTerrainUIStore((s) => s.isSelecting);
  const isMeasuring = useTerrainUIStore((s) => s.isMeasuring);
  const mapStyle = useTerrainUIStore((s) => s.mapStyle);
  const { isDarkMode } = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [mapForChildren, setMapForChildren] = useState<maplibregl.Map | null>(null);
  const [mapDiagnostics, setMapDiagnostics] = useState<{
    hostWidth: number;
    hostHeight: number;
    mapCreated: boolean;
    styleLoaded: boolean;
    iconsReady: boolean;
    sourceHouseholds: boolean;
    sourceSupercluster: boolean;
    layerHouseholds: boolean;
    layerGlow: boolean;
    layerCluster: boolean;
    geoJsonFeatures: number;
    sourceFeatures: number;
    renderedFeatures: number;
    zoom: number;
  }>({
    hostWidth: 0,
    hostHeight: 0,
    mapCreated: false,
    styleLoaded: false,
    iconsReady: false,
    sourceHouseholds: false,
    sourceSupercluster: false,
    layerHouseholds: false,
    layerGlow: false,
    layerCluster: false,
    geoJsonFeatures: 0,
    sourceFeatures: 0,
    renderedFeatures: 0,
    zoom: 0,
  });

  // ── Interactive State (Tooltips) ──
  const [hoverData, setHoverData] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const mapStyleRef = useRef(mapStyle);
  useEffect(() => {
    mapStyleRef.current = mapStyle;
  }, [mapStyle]);

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
    const lng = safeNumber(
      selectedHousehold.location?.coordinates?.[0] ?? selectedHousehold.longitude
    );
    const lat = safeNumber(
      selectedHousehold.location?.coordinates?.[1] ?? selectedHousehold.latitude
    );
    return lng !== null && lat !== null ? [lng, lat] : null;
  }, [selectedHousehold]);
  const [householdGeoJSON, setHouseholdGeoJSON] = useState<any>(null);
  const viewportStorageKey = useMemo(
    () => `gem-terrain-viewport:${projectId || 'default'}`,
    [projectId]
  );

  // ✅ Sync GeoJSON via worker with debouncing and smart diffing
  const geoJsonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevHashRef = useRef<string>('');

  useEffect(() => {
    if (!activeHouseholds || activeHouseholds.length === 0) {
      const t = setTimeout(() => setHouseholdGeoJSON({ type: 'FeatureCollection', features: [] }), 0);
      return () => clearTimeout(t);
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

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string; stack?: string } | undefined;
      const message = reason?.message || '';
      const stack = reason?.stack || '';

      const isMapLibreAbort =
        reason?.name === 'AbortError' &&
        /signal is aborted|aborted without reason/i.test(message) &&
        /maplibre|MapLibreVectorMap/i.test(stack);

      if (isMapLibreAbort) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const computeDiagnostics = () => {
      const map = mapInstanceRef.current;
      const rect = mapContainerRef.current?.getBoundingClientRect();
      const hostWidth = rect ? Math.round(rect.width) : 0;
      const hostHeight = rect ? Math.round(rect.height) : 0;

      let styleLoaded = false;
      let sourceHouseholds = false;
      let sourceSupercluster = false;
      let layerHouseholds = false;
      let layerGlow = false;
      let layerCluster = false;
      let sourceFeatures = 0;
      let renderedFeatures = 0;
      let zoom = 0;

      if (map && !(map as any)._removed) {
        styleLoaded = map.isStyleLoaded();
        sourceHouseholds = !!map.getSource('households');
        sourceSupercluster = !!map.getSource('supercluster-generated');
        layerHouseholds = !!map.getLayer('households-local-layer');
        layerGlow = !!map.getLayer('households-glow-layer');
        layerCluster = !!map.getLayer('cluster-circles');
        zoom = Number(map.getZoom().toFixed(2));

        const source = map.getSource('households') as
          | (maplibregl.GeoJSONSource & { _data?: { features?: unknown[] } })
          | undefined;
        sourceFeatures = Array.isArray(source?._data?.features) ? source!._data!.features!.length : 0;

        try {
          const interactiveLayers = [
            'households-local-layer',
            'households-glow-layer',
            'households-photo-badge',
          ].filter((layerId) => map.getLayer(layerId));

          if (interactiveLayers.length > 0) {
            renderedFeatures = map.queryRenderedFeatures(undefined, {
              layers: interactiveLayers,
            }).length;
          }
        } catch (error) {
          renderedFeatures = -1;
        }
      }

      setMapDiagnostics({
        hostWidth,
        hostHeight,
        mapCreated: !!map && !(map as any)?._removed,
        styleLoaded,
        iconsReady,
        sourceHouseholds,
        sourceSupercluster,
        layerHouseholds,
        layerGlow,
        layerCluster,
        geoJsonFeatures: householdGeoJSON?.features?.length || 0,
        sourceFeatures,
        renderedFeatures,
        zoom,
      });
    };

    const intervalId = setInterval(computeDiagnostics, 800);
    const timeoutId = setTimeout(computeDiagnostics, 0);
    const map = mapInstanceRef.current;

    if (map && !(map as any)._removed) {
      map.on('load', computeDiagnostics);
      map.on('styledata', computeDiagnostics);
      map.on('idle', computeDiagnostics);
      map.on('moveend', computeDiagnostics);
      map.on('zoomend', computeDiagnostics);
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (map && !(map as any)._removed) {
        map.off('load', computeDiagnostics);
        map.off('styledata', computeDiagnostics);
        map.off('idle', computeDiagnostics);
        map.off('moveend', computeDiagnostics);
        map.off('zoomend', computeDiagnostics);
      }
    };
  }, [iconsReady, householdGeoJSON]);

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
    if (
      !mapContainerRef.current ||
      !mapHostRef.current ||
      hasInitialized.current ||
      mapInstanceRef.current
    ) {
      return;
    }

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    const frameIds: number[] = [];
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let cleanupFn: (() => void) | null = null;

    const initLocalMap = async () => {
      isDestroyingRef.current = false;

      let initialCenter: [number, number] = [-14.45, 14.5];
      let initialZoom = 7;

      try {
        const rawViewport = safeStorage.getItem(viewportStorageKey);
        if (rawViewport && !mapCommand) {
          const parsedViewport = JSON.parse(rawViewport) as {
            center?: [number, number];
            zoom?: number;
          };
          if (
            Array.isArray(parsedViewport?.center) &&
            parsedViewport.center.length === 2 &&
            Number.isFinite(parsedViewport.center[0]) &&
            Number.isFinite(parsedViewport.center[1])
          ) {
            initialCenter = parsedViewport.center;
            initialZoom =
              typeof parsedViewport.zoom === 'number' && Number.isFinite(parsedViewport.zoom)
                ? parsedViewport.zoom
                : initialZoom;
          }
        }
      } catch (error) {
        logger.debug('[Terrain] Impossible de restaurer la dernière vue carte.', error);
      }

      const container = mapHostRef.current;
      if (!container) return () => undefined;

      container.innerHTML = '';

      const mapOptions: maplibregl.MapOptions = {
        container,
        style: resolveMapStyle(mapStyle, isDarkMode) as any,
        center: initialCenter,
        zoom: initialZoom,
        pitch: 0,
        maxPitch: 85,
        bearing: 0,
        transformRequest: (url) => {
          if (url.includes('households') && !url.includes('t=')) {
            return { url: `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` };
          }
          return { url };
        },
      };

      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map(mapOptions);
        setMapInitError(null);
      } catch (primaryError: any) {
        logger.error('[Terrain] ❌ Primary MapLibre init failed, trying raster fallback:', primaryError);

        try {
          map = new maplibregl.Map({
            ...mapOptions,
            style: MAP_STYLE_FALLBACK_RASTER as any,
          });
          setMapInitError(null);
          toast.error('Style principal indisponible, carte chargée en mode de secours.');
        } catch (fallbackError: any) {
          logger.error('[Terrain] ❌ Fallback MapLibre init failed:', fallbackError);
          setMapInitError(fallbackError?.message || primaryError?.message || 'Map init failed');
          return () => undefined;
        }
      }

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
        'top-right'
      );
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

      lastTargetSourceRef.current = mapStyle;

      const syncMapViewport = () => {
        if (!isMounted || !mapContainerRef.current || (map as any)._removed) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        map.resize();
        map.triggerRepaint();
      };

      hasInitialized.current = true;
      syncMapViewport();
      frameIds.push(
        requestAnimationFrame(() => {
          syncMapViewport();
          frameIds.push(requestAnimationFrame(syncMapViewport));
        })
      );
      timeoutIds.push(setTimeout(syncMapViewport, 120));
      timeoutIds.push(setTimeout(syncMapViewport, 320));

      mapInstanceRef.current = map;
      setMapForChildren(map);
      (window as any).mapInstance = map; // ✅ Safety Net for legacy/minified references
      setIsMapReady(false);

      if (!isMounted || isDestroyingRef.current) {
        isDestroyingRef.current = true;
        if (!(map as any)._removed) {
          try {
            map.remove();
          } catch (error: any) {
            if (error?.name !== 'AbortError') {
              logger.warn('[Terrain] Map remove aborted during strict cleanup:', error);
            }
          }
        }
        hasInitialized.current = false;
        mapInstanceRef.current = null;
        setMapForChildren(null);
        setStyleIsReady(false);
        setIconsReady(false);
        setIsMapReady(false);
        return () => undefined;
      }

      const checkAndLoad = async () => {
        if (map.isStyleLoaded()) {
          setStyleIsReady(true);
          await registerIcons(map);
          setIconsReady(true);
          setIsMapReady(true);
        }
      };

      const handleStyleLoad = async () => {
        setStyleIsReady(true);
        setIconsReady(false); // Reset while loading new icons
        await registerIcons(map);
        setIconsReady(true);
        setIsMapReady(true);
        lastTargetSourceRef.current = mapStyleRef.current;
        setMapInitError(null);
        syncMapViewport();
      };

      const handleMapError = (event: any) => {
        const message =
          event?.error?.message ||
          event?.sourceId ||
          event?.tile?.state ||
          'Erreur de chargement cartographique';

        logger.error('[Terrain] MapLibre runtime error:', event?.error || event);

        const shouldFallback =
          !map.isStyleLoaded() &&
          lastTargetSourceRef.current !== 'fallback-raster';

        if (shouldFallback) {
          lastTargetSourceRef.current = 'fallback-raster';
          try {
            map.setStyle(MAP_STYLE_FALLBACK_RASTER as any, { diff: false });
            toast.error('Fond cartographique principal indisponible, passage en mode de secours.');
            return;
          } catch (fallbackError: any) {
            logger.error('[Terrain] Raster fallback switch failed:', fallbackError);
          }
        }

        setMapInitError(message);
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
          logger.debug('Map query skipping:', err.message);
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
        try {
          const center = map.getCenter();
          safeStorage.setItem(
            viewportStorageKey,
            JSON.stringify({
              center: [center.lng, center.lat],
              zoom: map.getZoom(),
            })
          );
        } catch (error) {
          logger.debug('[Terrain] Impossible de mémoriser la dernière vue carte.', error);
        }
        onBoundsChangeRef.current?.(map.getBounds().toArray().flat() as any);
      };

      map.on('mousemove', handleMouseMove);
      map.on('mouseleave', handleMouseLeave);
      map.on('move', handleMove);
      map.on('moveend', handleMoveEnd);
      map.on('style.load', handleStyleLoad);
      map.on('error', handleMapError);
      map.on('styledata', syncMapViewport);
      
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          syncMapViewport();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      checkAndLoad();

      return () => {
        isDestroyingRef.current = true;
        map.off('mousemove', handleMouseMove);
        map.off('mouseleave', handleMouseLeave);
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
      map.off('style.load', handleStyleLoad);
      map.off('error', handleMapError);
      map.off('styledata', syncMapViewport);
        resizeObserver?.disconnect();
        frameIds.forEach((id) => cancelAnimationFrame(id));
        timeoutIds.forEach((id) => clearTimeout(id));
        if (!(map as any)._removed) {
          try {
            map.remove();
          } catch (error: any) {
            if (error?.name !== 'AbortError') {
              logger.warn('[Terrain] Map remove aborted during cleanup:', error);
            }
          }
        }
        hasInitialized.current = false;
        mapInstanceRef.current = null;
        setMapForChildren(null);
        setStyleIsReady(false);
        setIconsReady(false);
        setIsMapReady(false);
      };
    };

    void initLocalMap().then((fn) => {
      if (!isMounted || isDestroyingRef.current) {
        fn?.();
        return;
      }
      cleanupFn = fn || null;
    });

    return () => {
      isMounted = false;
      isDestroyingRef.current = true;
      resizeObserver?.disconnect();
      frameIds.forEach((id) => cancelAnimationFrame(id));
      timeoutIds.forEach((id) => clearTimeout(id));
      cleanupMarkers();
      cleanupFn?.();
    };
  }, [viewportStorageKey]);

  const lastTargetSourceRef = useRef<string | null>(null);

  // ✅ Unified Style switcher (via Singleton)
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || (currentMap as any)._removed || !isMapReady || isDestroyingRef.current) {
      return;
    }

    const targetSource = mapStyle;
    if (lastTargetSourceRef.current === targetSource && currentMap.isStyleLoaded()) {
      return;
    }

    const applyStyle = () => {
      if (
        !mapInstanceRef.current ||
        mapInstanceRef.current !== currentMap ||
        (currentMap as any)._removed ||
        isDestroyingRef.current
      ) {
        return;
      }

      if (lastTargetSourceRef.current === targetSource && currentMap.isStyleLoaded()) {
        return;
      }

      logger.debug(`[Terrain] 🚀 Switching style to: ${targetSource}`);
      lastTargetSourceRef.current = targetSource;

      const t1 = setTimeout(() => setStyleIsReady(false), 0);
      const t2 = setTimeout(() => setIconsReady(false), 0);
      const t3 = setTimeout(() => setIsMapReady(false), 0);

      try {
        (currentMap as unknown as { _placement?: unknown })._placement = undefined;
        currentMap.setStyle(resolveMapStyle(targetSource, isDarkMode), { diff: false });
      } catch (error) {
        logger.error('[Terrain] ❌ Failed to switch map style:', error);
        const fallbackTimer = setTimeout(() => {
          if (!isDestroyingRef.current) {
            setStyleIsReady(true);
            setIconsReady(true);
            setIsMapReady(true);
          }
        }, 0);

        return () => clearTimeout(fallbackTimer);
      }

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    };

    if (!currentMap.isStyleLoaded()) {
      currentMap.once('load', applyStyle);
      return () => {
        currentMap.off('load', applyStyle);
      };
    }

    return applyStyle();
  }, [mapStyle, isDarkMode, isMapReady]);

  // ✅ Commands handler
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !mapCommand || !styleIsReady) return;
    const { center, zoom, bounds } = mapCommand;
    if (bounds) {
      currentMap.fitBounds(bounds, { padding: 50, maxZoom: 18 });
    } else if (center) {
      currentMap.flyTo({
        center,
        zoom: zoom || currentMap.getZoom(),
        duration: 2000,
        essential: true,
      });
    }
  }, [mapCommand, styleIsReady]);

  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !isMapReady || !styleIsReady) return;

    const syncVisibleMap = () => {
      if ((currentMap as any)._removed) return;
      currentMap.resize();
      currentMap.triggerRepaint();
    };

    const rafId = requestAnimationFrame(syncVisibleMap);
    const timeoutId = setTimeout(syncVisibleMap, 150);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [isMapReady, styleIsReady]);

  const initializedToolsRef = useRef<string | null>(null);

  // ✅ Baseline Tools Initialization (One-time or on style change)
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !styleIsReady || !iconsReady || !currentMap.isStyleLoaded()) return;

    // Token for double-init prevention (style + features + projectId)
    const initToken = `${lastTargetSourceRef.current}-${householdGeoJSON?.features?.length || 0}-${projectId}`;
    if (initializedToolsRef.current === initToken) return;
    initializedToolsRef.current = initToken;

    logger.debug(`[Terrain] 🛠️ Initializing map baseline tools (${initToken})...`);
    const cleanups: Array<(() => void) | undefined> = [];
    try {
      cleanups.push(setupInteractions(currentMap));
      cleanups.push(setupClusteringEvents(currentMap));
      setupUserMarker(currentMap, userLocation);
    } catch (e) {
      logger.error('[Terrain] ❌ Failed to initialize baseline tools:', e);
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup && cleanup());
    };
  }, [
    isMapReady,
    styleIsReady,
    iconsReady, // Added explicit dependencies
    setupInteractions,
    setupClusteringEvents,
    setupUserMarker,
    userLocation,
    projectId,
    householdGeoJSON?.features?.length
  ]);

  // ✅ REACTIVE TOOL: RULER (Mesure)
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !styleIsReady || !iconsReady) return;
    const cleanup = setupMeasureTool(currentMap, isMeasuring);
    return () => cleanup && cleanup();
  }, [isMapReady, styleIsReady, iconsReady, isMeasuring, setupMeasureTool]);

  // ✅ REACTIVE TOOL: LASSO (Sélection)
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !styleIsReady || !iconsReady) return;
    const cleanup = setupLasso(currentMap);
    return () => cleanup && cleanup();
  }, [isMapReady, styleIsReady, iconsReady, isSelecting, setupLasso]);


  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap) return;

    const handleZoom = () => {
      const zoom = currentMap.getZoom();
      const minZ = 14;
      const maxZ = 17;
      const maxPitch = 45;

      if (zoom <= minZ) {
        if (currentMap.getPitch() !== 0) currentMap.setPitch(0);
      } else if (zoom >= maxZ) {
        if (currentMap.getPitch() !== maxPitch) currentMap.setPitch(maxPitch);
      } else {
        // Interpolation linéaire pour l'effet "Caméra Drone"
        const progress = (zoom - minZ) / (maxZ - minZ);
        currentMap.setPitch(progress * maxPitch);
      }
    };

    currentMap.on('zoom', handleZoom);
    return () => {
      currentMap.off('zoom', handleZoom);
    };
  }, [isMapReady]);

  // Force cluster update when households change (OR style reload OR zone toggle)
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (currentMap && styleIsReady) {
      if (showZones) {
        // Force clear generic clusters
        const clusterSource = currentMap.getSource('supercluster-generated') as any;
        if (clusterSource?.setData) clusterSource.setData({ type: 'FeatureCollection', features: [] });
        const hullSource = currentMap.getSource('cluster-hulls') as any;
        if (hullSource?.setData) hullSource.setData({ type: 'FeatureCollection', features: [] });
      } else {
        updateClusterDisplay(currentMap, true);
      }
    }
  }, [households, isMapReady, styleIsReady, updateClusterDisplay, showZones]);

  // ── 9. LAYER VISIBILITY HARMONIZATION ──
  // Si on affiche les Zones (Villages), on cache les grappes circulaires standard
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !styleIsReady) return;
    
    const clusterLayers = ['cluster-halo', 'cluster-circles', 'cluster-counts'];
    const pointLayers = [
      'households-local-layer', 
      'households-glow-layer', 
      'households-symbol-layer',
      'households-labels-simple',
      'households-photo-badge'
    ];
    
    clusterLayers.forEach(layerId => {
      if (currentMap.getLayer(layerId)) {
        // Mode zones : on masque les grappes génériques (cercles/chiffres)
        currentMap.setLayoutProperty(layerId, 'visibility', showZones ? 'none' : 'visible');
      }
    });

    pointLayers.forEach(layerId => {
      if (currentMap.getLayer(layerId)) {
        // On GARDE les ménages visibles
        currentMap.setLayoutProperty(layerId, 'visibility', 'visible');
        
        // MAIS on réduit drastiquement l'effet "cercle" (halo) pour ne pas polluer les trapèzes
        if (layerId === 'households-glow-layer') {
          currentMap.setPaintProperty(layerId, 'circle-opacity', showZones ? 0.2 : 0.85);
          currentMap.setPaintProperty(layerId, 'circle-stroke-width', showZones ? 0 : 1.5);
          currentMap.setPaintProperty(layerId, 'circle-radius', showZones ? 2 : 6);
        }
      }
    });

    // ── NOUVEAU : On s'assure que les Grappes Proximité (Hulls) sont affichées
    const superclusterHulls = ['supercluster-hulls-fill', 'supercluster-hulls-outline'];
    superclusterHulls.forEach(id => {
      if (currentMap.getLayer(id)) {
        currentMap.setLayoutProperty(id, 'visibility', showZones ? 'visible' : 'none');
      }
    });
  }, [isMapReady, styleIsReady, showZones]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full relative outline-none bg-slate-900 overflow-hidden"
    >
      {mapInitError && (
        <div className="absolute inset-0 z-[1400] flex items-center justify-center bg-slate-950/92 p-6 text-center">
          <div className="max-w-lg rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 shadow-2xl">
            <div className="mb-3 text-4xl">⚠️</div>
            <h3 className="text-lg font-bold text-white">Initialisation carte impossible</h3>
            <p className="mt-2 text-sm text-rose-100/90">
              {mapInitError}
            </p>
          </div>
        </div>
      )}
      <div ref={mapHostRef} className="absolute inset-0 z-0" />

      <div className="pointer-events-none absolute right-3 top-3 z-[1200] max-w-[280px] rounded-2xl border border-white/10 bg-slate-950/88 px-3 py-2 font-mono text-[10px] text-cyan-100 shadow-2xl backdrop-blur">
        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
          Terrain Debug
        </div>
        <div>{`host ${mapDiagnostics.hostWidth}x${mapDiagnostics.hostHeight}`}</div>
        <div>{`map ${mapDiagnostics.mapCreated ? 'ok' : 'ko'} | style ${mapDiagnostics.styleLoaded ? 'ok' : 'ko'} | icons ${mapDiagnostics.iconsReady ? 'ok' : 'ko'}`}</div>
        <div>{`src households ${mapDiagnostics.sourceHouseholds ? 'ok' : 'ko'} | supercluster ${mapDiagnostics.sourceSupercluster ? 'ok' : 'ko'}`}</div>
        <div>{`layers point ${mapDiagnostics.layerHouseholds ? 'ok' : 'ko'} | glow ${mapDiagnostics.layerGlow ? 'ok' : 'ko'} | cluster ${mapDiagnostics.layerCluster ? 'ok' : 'ko'}`}</div>
        <div>{`geojson ${mapDiagnostics.geoJsonFeatures} | source ${mapDiagnostics.sourceFeatures} | rendered ${mapDiagnostics.renderedFeatures}`}</div>
        <div>{`zoom ${mapDiagnostics.zoom}`}</div>
      </div>

      {/* Modular Layers */}
      <BackgroundLayer map={mapForChildren} />

      <HouseholdLayer
        map={mapForChildren}
        householdGeoJSON={householdGeoJSON}
        households={activeHouseholds}
        projectId={projectId}
        selectedHouseholdCoords={selectedHouseholdCoords}
        showHeatmap={showHeatmap}
        styleIsReady={styleIsReady && iconsReady}
      />
      <ZoneLayer
        map={mapForChildren}
        styleIsReady={styleIsReady}
        grappeZonesData={grappeZonesData}
        grappeCentroidsData={grappeCentroidsData}
        showZones={showZones}
      />

      <LogisticsLayer map={mapForChildren} styleIsReady={styleIsReady} warehouses={warehouses} />

      <InteractionLayer
        map={mapForChildren}
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

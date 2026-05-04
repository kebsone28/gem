/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';

// ✅ Optimize worker threads for terrain use
maplibregl.setWorkerCount(2);

import { useMapInteractions } from './useMapInteractions';
import { useMapClustering } from './useMapClustering';
import { useMapMarkers } from './useMapMarkers';
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
import HighlightLayer from './layers/HighlightLayer';
import MapTooltip from './MapTooltip';
import { useSuperclusterWorker } from '../../hooks/useSuperclusterWorker';
import { householdsToGeoJSON } from '../../utils/clusteringUtils';
import { registerIcons } from './mapUtils';

registerTileCacheProtocol();

type TerrainMapStyle = 'dark' | 'light' | 'satellite';
const FALLBACK_STYLE_SOURCE = 'fallback-raster';

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

const withStyleSource = (
  style: StyleSpecification | string,
  source: TerrainMapStyle | typeof FALLBACK_STYLE_SOURCE
): StyleSpecification | string => {
  if (typeof style === 'string') return style;
  return {
    ...style,
    metadata: {
      ...((style as any).metadata || {}),
      source,
    },
  } as StyleSpecification;
};

const cloneStyle = (style: StyleSpecification): StyleSpecification => {
  if (typeof structuredClone === 'function') {
    return structuredClone(style);
  }
  return JSON.parse(JSON.stringify(style)) as StyleSpecification;
};

const resolveMapStyle = (
  style: TerrainMapStyle,
  isDarkMode: boolean
): StyleSpecification | string => {
  if (style === 'satellite') {
    return withStyleSource(cloneStyle(MAP_STYLE_SATELLITE), 'satellite');
  }

  if (style === 'light') {
    // If it's a URL (string), return as is
    if (typeof MAP_STYLE_LIGHT_VECTOR === 'string') return MAP_STYLE_LIGHT_VECTOR;
    return withStyleSource(cloneStyle(MAP_STYLE_LIGHT_VECTOR), 'light');
  }

  if (style === 'dark') return withStyleSource(cloneStyle(MAP_STYLE_DARK), 'dark');

  const defaultStyle = isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT_VECTOR;
  if (typeof defaultStyle === 'string') return defaultStyle;

  return withStyleSource(
    cloneStyle(defaultStyle as StyleSpecification),
    isDarkMode ? 'dark' : 'light'
  );
};

const resolveFallbackStyle = (): StyleSpecification =>
  withStyleSource(cloneStyle(MAP_STYLE_FALLBACK_RASTER), FALLBACK_STYLE_SOURCE) as StyleSpecification;

const getCurrentStyleSource = (map: maplibregl.Map | null): string | null => {
  if (!map || (map as any)._removed) return null;
  return ((map.getStyle() as unknown as { metadata?: { source?: string } })?.metadata?.source || null);
};

const isDomNotFoundError = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotFoundError';

const safeRemoveMap = (map: maplibregl.Map, context: string) => {
  if ((map as any)._removed) return;

  try {
    map.remove();
  } catch (error: any) {
    if (error?.name === 'AbortError' || isDomNotFoundError(error)) {
      logger.debug(`[Terrain] Map cleanup skipped after ${context}:`, error);
      return;
    }

    logger.warn(`[Terrain] Map remove failed during ${context}:`, error);
  }
};

const MapLibreVectorMap: React.FC<any> = ({
  households,
  selectedHouseholdId,
  mapCommand,
  onZoneClick,
  grappesConfig,
  readOnly = false,
  grappeZonesData,
  grappeCentroidsData,
  userLocation,
  onHouseholdDrop,
  onMove,
  onBoundsChange,
  projectId,
  warehouses = [],
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
    activeStyle: string;
    activeSource: string;
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
    activeStyle: 'none',
    activeSource: 'none',
  });
  const showDiagnostics = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem('gem_terrain_debug') === 'true',
    []
  );

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
  const hasZoneFeatures = useMemo(() => {
    const zoneCount = Array.isArray(grappeZonesData?.features) ? grappeZonesData.features.length : 0;
    const centroidCount = Array.isArray(grappeCentroidsData?.features)
      ? grappeCentroidsData.features.length
      : 0;
    return zoneCount > 0 || centroidCount > 0;
  }, [grappeZonesData, grappeCentroidsData]);
  const zonesModeActive = showZones && hasZoneFeatures;

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
        styleLoaded = Boolean(map.isStyleLoaded());
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
        activeStyle: mapStyleRef.current,
        activeSource: getCurrentStyleSource(map) || 'unknown',
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
  const { setupClusteringEvents, updateClusterDisplay } = useMapClustering(
    clusterWorker,
    activeHouseholds,
    householdGeoJSON?.features || []
  );
  const { setupUserMarker, cleanup: cleanupMarkers } = useMapMarkers(userLocation);

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

    const initLocalMap = () => {
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

      if (!container.firstChild) {
        container.textContent = '';
      }

      const mapOptions: maplibregl.MapOptions = {
        container,
        style: resolveMapStyle(mapStyle, isDarkMode) as any,
        center: initialCenter,
        zoom: initialZoom,
        maxZoom: 24,
        pitch: 0,
        maxPitch: 85,
        bearing: 0,
        transformRequest: (url, resourceType) => {
          // 1. Force refresh for dynamic households data
          if (url.includes('households') && !url.includes('t=')) {
            return { url: `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` };
          }

          // 2. Redirect Glyphs/Fonts to a stable provider (solve 404s/corrupt PBFs)
          if (resourceType === 'Glyphs') {
            const fontStack =
              url.split('/fonts/')[1]?.split('/')[0] ||
              url.split('/font/')[1]?.split('/')[0] ||
              'Open Sans Regular';
            const range = url.split('/').pop() || '0-255.pbf';
            const decodedFontStack = decodeURIComponent(fontStack);
            const supportedFontStack =
              decodedFontStack === 'Open Sans Regular'
                ? 'Open Sans Regular,Arial Unicode MS Regular'
                : decodedFontStack;
            const encodedFontStack = supportedFontStack
              .split(',')
              .map((font) => encodeURIComponent(font.trim()))
              .join(',');
            return {
              url: `https://demotiles.maplibre.org/font/${encodedFontStack}/${range}`
            };
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
            style: resolveFallbackStyle() as any,
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

      // ✅ Force Max Zoom explicitly on instance
      map.setMaxZoom(24);

      lastTargetSourceRef.current = getCurrentStyleSource(map) || mapStyle;

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
        safeRemoveMap(map, 'strict cleanup');
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
        if (!map || (map as any)._removed) return;

        logger.debug('[Terrain] 🎨 Style load detected, re-initializing layers...');

        // Immediate state reset to trigger clean re-render of modular layers
        setStyleIsReady(true);
        setIconsReady(false);

        // Re-force zoom constraints (cleared by setStyle)
        map.setMaxZoom(24);

        // Re-register icons as fast as possible
        await registerIcons(map);

        if (!isMounted || (map as any)._removed) return;

        setIconsReady(true);
        setIsMapReady(true);
        lastTargetSourceRef.current = getCurrentStyleSource(map) || mapStyleRef.current;
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
          mapStyleRef.current !== 'satellite' &&
          getCurrentStyleSource(map) !== FALLBACK_STYLE_SOURCE &&
          /style|glyph|sprite|validation|source|layer|load/i.test(String(message));

        if (shouldFallback) {
          lastTargetSourceRef.current = FALLBACK_STYLE_SOURCE;
          try {
            map.setStyle(resolveFallbackStyle() as any, { diff: false });
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
        safeRemoveMap(map, 'cleanup');
        hasInitialized.current = false;
        mapInstanceRef.current = null;
        setMapForChildren(null);
        setStyleIsReady(false);
        setIconsReady(false);
        setIsMapReady(false);
      };
    };

    const nextCleanup = initLocalMap();
    if (!isMounted || isDestroyingRef.current) {
      nextCleanup?.();
    } else {
      cleanupFn = nextCleanup || null;
    }

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
    const currentStyleSource = getCurrentStyleSource(currentMap) || lastTargetSourceRef.current;
    if (currentStyleSource === targetSource && currentMap.isStyleLoaded()) {
      return;
    }

    const applyStyle = () => {
      if (
        !mapInstanceRef.current ||
        (currentMap as any)._removed ||
        isDestroyingRef.current
      ) {
        return;
      }

      const activeStyleSource = getCurrentStyleSource(currentMap) || lastTargetSourceRef.current;
      if (activeStyleSource === targetSource && currentMap.isStyleLoaded()) {
        return;
      }

      logger.debug(`[Terrain] 🚀 Switching style to: ${targetSource}`);
      lastTargetSourceRef.current = targetSource;

      // Reset states immediately to let children know they need to re-add sources/layers
      setStyleIsReady(false);
      setIconsReady(false);
      setIsMapReady(false);

      try {
        // Clear placement engine to avoid collisions on style swap
        (currentMap as any)._placement = undefined;

        // Use setStyle with diff: false for complete replacement as we handle modular re-init
        currentMap.setStyle(resolveMapStyle(targetSource, isDarkMode), { diff: false });
        currentMap.setMaxZoom(24);
      } catch (error) {
        logger.error('[Terrain] ❌ Failed to switch map style:', error);
        setStyleIsReady(true);
        setIconsReady(true);
        setIsMapReady(true);
      }
    };

    if (!currentMap.isStyleLoaded()) {
      currentMap.once('style.load', applyStyle);
      return () => {
        currentMap.off('style.load', applyStyle);
      };
    }

    return applyStyle();
  }, [mapStyle, isDarkMode, isMapReady]);

  // ✅ Commands handler
  const lastCommandRef = useRef<string | null>(null);

  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !mapCommand || !styleIsReady) return;

    // Serialize command to prevent infinite loops if parent passes a new object reference every render
    const cmdStr = JSON.stringify(mapCommand);
    if (lastCommandRef.current === cmdStr) return;
    lastCommandRef.current = cmdStr;

    const { center, zoom, bounds } = mapCommand;
    if (bounds) {
      currentMap.fitBounds(bounds, { padding: 50, maxZoom: 21 });
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

    // Token for double-init prevention (style + projectId)
    const initToken = `${lastTargetSourceRef.current}-${projectId}`;
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
    iconsReady,
    setupInteractions,
    setupClusteringEvents,
    setupUserMarker,
    userLocation,
    projectId
  ]);



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
      updateClusterDisplay(currentMap, true, zonesModeActive);
    }
  }, [
    households,
    isMapReady,
    styleIsReady,
    updateClusterDisplay,
    zonesModeActive,
    clusterWorker.isLoaded,
  ]);

  // ── 9. HOUSEHOLD VISUAL HARMONIZATION ──
  // HouseholdLayer remains the single authority for cluster/zone visibility.
  useEffect(() => {
    const currentMap = mapInstanceRef.current;
    if (!currentMap || !styleIsReady) return;

    const pointLayers = [
      'households-local-layer',
      'households-glow-layer',
      'households-symbol-layer',
      'households-labels-simple',
      'households-photo-badge'
    ];

    pointLayers.forEach(layerId => {
      if (currentMap.getLayer(layerId)) {
        currentMap.setLayoutProperty(layerId, 'visibility', 'visible');

        if (layerId === 'households-glow-layer') {
          currentMap.setPaintProperty(layerId, 'circle-opacity', zonesModeActive ? 0.2 : 0.85);
          currentMap.setPaintProperty(layerId, 'circle-stroke-width', zonesModeActive ? 0 : 1.5);
          currentMap.setPaintProperty(layerId, 'circle-radius', zonesModeActive ? 2 : 6);
        }
      }
    });
  }, [isMapReady, styleIsReady, zonesModeActive]);

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
      <div ref={mapHostRef} className="absolute inset-0 z-0 h-full" />

      {showDiagnostics && (
        <div className="pointer-events-none absolute right-3 top-3 z-[1200] hidden max-w-[280px] rounded-2xl border border-white/10 bg-slate-950/88 px-3 py-2 font-mono text-[10px] text-cyan-100 shadow-2xl backdrop-blur md:block">
          <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Terrain Debug
          </div>
          <div>{`host ${mapDiagnostics.hostWidth}x${mapDiagnostics.hostHeight}`}</div>
          <div>{`map ${mapDiagnostics.mapCreated ? 'ok' : 'ko'} | style ${mapDiagnostics.styleLoaded ? 'ok' : 'ko'} | icons ${mapDiagnostics.iconsReady ? 'ok' : 'ko'}`}</div>
          <div>{`src households ${mapDiagnostics.sourceHouseholds ? 'ok' : 'ko'} | supercluster ${mapDiagnostics.sourceSupercluster ? 'ok' : 'ko'}`}</div>
          <div>{`layers point ${mapDiagnostics.layerHouseholds ? 'ok' : 'ko'} | glow ${mapDiagnostics.layerGlow ? 'ok' : 'ko'} | cluster ${mapDiagnostics.layerCluster ? 'ok' : 'ko'}`}</div>
          <div>{`geojson ${mapDiagnostics.geoJsonFeatures} | src ${mapDiagnostics.sourceFeatures} | rend ${mapDiagnostics.renderedFeatures}`}</div>
          <div className="flex justify-between gap-4 font-black uppercase text-[8px] mt-1 border-t border-white/10 pt-1">
            <span>{`Zoom ${mapDiagnostics.zoom}`}</span>
            <span>{`${mapDiagnostics.activeStyle} / ${mapDiagnostics.activeSource}`}</span>
          </div>
        </div>
      )}

      {/* Modular Layers */}
      <BackgroundLayer map={mapForChildren} />

      <HouseholdLayer
        map={mapForChildren}
        householdGeoJSON={householdGeoJSON}
        households={activeHouseholds}
        projectId={projectId}
        selectedHouseholdCoords={selectedHouseholdCoords}
        showHeatmap={showHeatmap}
        styleIsReady={styleIsReady}
        iconsReady={iconsReady}
        showZones={zonesModeActive}
      />
      <ZoneLayer
        map={mapForChildren}
        styleIsReady={styleIsReady}
        grappeZonesData={grappeZonesData}
        grappeCentroidsData={grappeCentroidsData}
        grappesConfig={grappesConfig}
        showZones={zonesModeActive}
      />

      <LogisticsLayer map={mapForChildren} styleIsReady={styleIsReady} warehouses={warehouses} />

      <InteractionLayer
        map={mapForChildren}
        styleIsReady={styleIsReady}
      />

      <HighlightLayer map={mapForChildren} />

      {/* PREMIUN HOVER TOOLTIP */}
      {hoverData && hoverPos && <MapTooltip data={hoverData} x={hoverPos.x} y={hoverPos.y} />}
    </div>
  );
};

export default React.memo(MapLibreVectorMap);

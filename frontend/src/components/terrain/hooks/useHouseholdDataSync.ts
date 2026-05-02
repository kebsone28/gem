/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { useCallback, useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';
import { getHouseholdDisplayName } from '../../../utils/householdDisplay';

/**
 * Hook: Household Data Sync
 *
 * Syncs GeoJSON data to the 'households' MapLibre source.
 * Robust against race conditions: the source may not exist immediately
 * after style load. Uses a retry loop (200ms) until source is available.
 */
export const useHouseholdDataSync = (
  map: maplibregl.Map | null,
  householdGeoJSON?: any,
  households?: any[]
): void => {
  const lastDataHashRef = useRef<string>('');
  const lastSourceRef = useRef<maplibregl.GeoJSONSource | null>(null);
  const setDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Lightweight hash to skip unnecessary setData calls ──
  const dataHash = useMemo(() => {
    const versionChecksum = Array.isArray(households)
      ? households.reduce((sum, h) => sum + (h.version || 0), 0)
      : 0;

    if (householdGeoJSON?.features) {
      return `worker:${householdGeoJSON.features.length}:${versionChecksum}`;
    }
    if (households && households.length > 0) {
      return `fallback:${households.length}:${versionChecksum}`;
    }
    return 'empty:0';
  }, [householdGeoJSON, households]);

  // ── Build the GeoJSON to inject into the source ──
  const buildDataToApply = useCallback((): any => {
    // Priority 1: Worker-processed GeoJSON (already sanitized + deduplicated)
    if (householdGeoJSON?.features && householdGeoJSON.features.length > 0) {
      return householdGeoJSON;
    }

    // Priority 2: Raw households array (direct fallback)
    if (households && households.length > 0) {
      const features = households
        .map((h: any) => {
          let lng = Number(h.location?.coordinates?.[0] ?? h.longitude ?? 0);
          let lat = Number(h.location?.coordinates?.[1] ?? h.latitude ?? 0);

          // 🇸🇳 Auto-correct Senegal coordinates
          if (lng > 0 && lat < 0) [lng, lat] = [lat, lng];
          if (Math.abs(lng) > 11 && Math.abs(lng) < 18) lng = -Math.abs(lng);
          if (Math.abs(lat) > 11 && Math.abs(lat) < 17) lat = Math.abs(lat);

          if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
            return null;
          }

          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
              id: h.id,
              status: h.status || 'Non encore installée',
              numeroordre: h.numeroordre || '',
              name: getHouseholdDisplayName(h),
            },
          };
        })
        .filter(Boolean);

      return { type: 'FeatureCollection', features };
    }

    return { type: 'FeatureCollection', features: [] };
  }, [householdGeoJSON, households]);

  // ── Main Sync Effect ──
  useEffect(() => {
    if (!map) return;

    // Clear any pending retry from previous effect run
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }

    const tryApply = (force = false): boolean => {
      if (!map || (map as any)._removed) return true; // Map destroyed, stop retrying
      if (!map.isStyleLoaded()) return false;

      const source = map.getSource('households') as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        // Source not yet created by useHouseholdSources — keep retrying
        return false;
      }

      // Detect source instance change after style reload (old source is gone)
      if (lastSourceRef.current !== source) {
        lastSourceRef.current = source;
        lastDataHashRef.current = ''; // Force re-apply on new source instance
      }

      // Skip if data unchanged and not forced
      if (!force && dataHash === lastDataHashRef.current) return true;

      // Debounce to batch rapid successive updates (e.g. filter change + data change)
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);

      setDataTimeoutRef.current = setTimeout(() => {
        const s = map.getSource('households') as maplibregl.GeoJSONSource | undefined;
        if (!s || (map as any)._removed) return;

        const dataToApply = buildDataToApply();
        s.setData(dataToApply as any);
        lastDataHashRef.current = dataHash;

        logger.debug(
          `✅ [DataSync] setData → ${dataToApply.features?.length ?? 0} features (${dataHash})`
        );
      }, 20);

      return true;
    };

    // ── Attempt #1: immediate ──
    const appliedImmediately = tryApply();

    // ── Attempt #2: retry loop if source not ready yet ──
    if (!appliedImmediately) {
      logger.debug('[DataSync] Source "households" not ready, polling every 200ms...');
      retryIntervalRef.current = setInterval(() => {
        const ok = tryApply(true);
        if (ok) {
          clearInterval(retryIntervalRef.current!);
          retryIntervalRef.current = null;
          logger.debug('[DataSync] ✅ Retry succeeded — data injected into source.');
        }
      }, 200);
    }

    // ── Re-apply on style reload (sources are wiped) ──
    const handleStyleReload = () => {
      lastDataHashRef.current = '';
      lastSourceRef.current = null;

      // Stop existing retry and start fresh
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }

      const ok = tryApply(true);
      if (!ok) {
        retryIntervalRef.current = setInterval(() => {
          const ok2 = tryApply(true);
          if (ok2) {
            clearInterval(retryIntervalRef.current!);
            retryIntervalRef.current = null;
          }
        }, 200);
      }
    };

    // ── Re-apply when map becomes fully idle (catches deferred style loads) ──
    const handleIdle = () => tryApply();

    map.on('styledata', handleStyleReload);
    map.on('idle', handleIdle);

    return () => {
      if (map && !(map as any)._removed) {
        map.off('styledata', handleStyleReload);
        map.off('idle', handleIdle);
      }
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [buildDataToApply, dataHash, map]); // Only re-run when map instance or data changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    };
  }, []);
};

/**
 * Hook: Selected Household Sync
 * Syncs selected household coords to the 'selected-household' source.
 */
export const useSelectedHouseholdSync = (
  map: maplibregl.Map | null,
  selectedCoords?: [number, number] | null
): void => {
  useEffect(() => {
    if (!map) return;

    const trySet = () => {
      if (!map.isStyleLoaded()) return;
      const source = map.getSource('selected-household') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: selectedCoords
          ? [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: selectedCoords },
                properties: { selected: true },
              },
            ]
          : [],
      });
    };

    trySet();
    map.on('styledata', trySet);
    return () => {
      if (!(map as any)._removed) map.off('styledata', trySet);
    };
  }, [map, selectedCoords]);
};

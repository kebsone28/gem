/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import logger from '../../../utils/logger';

/**
 * Hook: Household Data Sync
 *
 * Syncs GeoJSON data to household sources using lightweight hash
 * for memory efficiency (no JSON.stringify).
 *
 * @param map - MapLibre GL map instance
 * @param householdGeoJSON - GeoJSON FeatureCollection from worker
 * @param households - Household array fallback
 */
export const useHouseholdDataSync = (
  map: maplibregl.Map | null,
  householdGeoJSON?: any,
  households?: any[]
): void => {
  /**
   * REFINED: Lightweight hash instead of JSON.stringify.
   * To prevent the 'String Meat Grinder' effect, we use length and total versions.
   */
  const lastDataHashRef = useRef<string>('');
  const lastSourceRef = useRef<maplibregl.GeoJSONSource | null>(null);
  const setDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoveryAttemptRef = useRef<number>(0);

  const dataHash = useMemo(() => {
    const versionChecksum = Array.isArray(households)
      ? households.reduce((sum, h) => sum + (h.version || 0), 0)
      : 0;

    if (householdGeoJSON?.features) {
      // Worker result is already deduplicated; pair it with version checksum
      return `worker:${householdGeoJSON.features.length}:${versionChecksum}`;
    }
    if (households && households.length > 0) {
      return `fallback:${households.length}:${versionChecksum}`;
    }
    return 'empty:0';
  }, [householdGeoJSON, households]);
  const expectedFeatureCount = useMemo(() => {
    if (householdGeoJSON?.features) return householdGeoJSON.features.length;
    if (households && households.length > 0) return households.length;
    return 0;
  }, [householdGeoJSON, households]);

  // ── Main GeoJSON Sync ──
  useEffect(() => {
    if (!map) return;

    const buildDataToApply = () => {
      if (householdGeoJSON?.features) {
        return householdGeoJSON;
      }

      if (households && households.length > 0) {
        return {
          type: 'FeatureCollection',
          features: households.map((h: any) => {
            let safeStatus = h.status || 'Non encore installée';
            try {
              const lower = safeStatus.toLowerCase();
              if (
                lower.includes('début') ||
                lower.includes('debut') ||
                lower.includes('demarr') ||
                lower.includes('démarr') ||
                lower.includes('pending') ||
                lower.includes('install')
              ) {
                safeStatus = 'Non encore installée';
              }
            } catch (e) {}

            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: h.location?.coordinates || [0, 0] },
              properties: { id: h.id, status: safeStatus },
            };
          }),
        };
      }

      return { type: 'FeatureCollection', features: [] };
    };

    const applyData = (force = false) => {
      if (!map.isStyleLoaded()) return;

      const source = map.getSource('households') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      // If the style reloaded, the source instance changes. Force a full re-apply.
      if (lastSourceRef.current !== source) {
        lastSourceRef.current = source;
        lastDataHashRef.current = '';
      }

      // Hash unchanged + source was already available = no update needed
      if (!force && dataHash === lastDataHashRef.current) return;

      // Debounce setData to prevent rapid successive updates
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);

      setDataTimeoutRef.current = setTimeout(() => {
        const dataToApply = buildDataToApply();

        source.setData(dataToApply);
        lastDataHashRef.current = dataHash;
        logger.debug(`🚀 [MapPerformance] Fast-Sync: ${dataToApply.features?.length || 0} pts`);
      }, 16); // 16ms = 1 frame delay (smooth update)
    };

    const recoverIfSourceLooksEmpty = () => {
      if (!map.isStyleLoaded() || expectedFeatureCount <= 0) return;

      const source = map.getSource('households') as
        | (maplibregl.GeoJSONSource & { _data?: { features?: unknown[] } })
        | undefined;
      if (!source) return;

      const sourceFeatureCount = Array.isArray(source._data?.features) ? source._data.features.length : null;
      const shouldRecover =
        sourceFeatureCount === 0 &&
        Date.now() - lastRecoveryAttemptRef.current > 800;

      if (!shouldRecover) return;

      lastRecoveryAttemptRef.current = Date.now();
      lastDataHashRef.current = '';
      logger.warn('[Terrain] Source ménages vide alors que des données existent. Réinjection automatique.');
      applyData(true);
    };

    // Try immediately — style may already be loaded
    applyData();
    recoverIfSourceLooksEmpty();

    // ✅ Retry when style becomes ready (handles race conditions on initial load)
    map.on('styledata', applyData);
    map.on('idle', applyData);
    map.on('styledata', recoverIfSourceLooksEmpty);
    map.on('idle', recoverIfSourceLooksEmpty);

    return () => {
      map.off('styledata', applyData);
      map.off('idle', applyData);
      map.off('styledata', recoverIfSourceLooksEmpty);
      map.off('idle', recoverIfSourceLooksEmpty);
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);
    };
  }, [map, dataHash, expectedFeatureCount, householdGeoJSON, households]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (setDataTimeoutRef.current) {
        clearTimeout(setDataTimeoutRef.current);
      }
    };
  }, []);
};

/**
 * Hook: Selected Household Sync
 *
 * Syncs selected household coordinates to the selected-household source.
 *
 * @param map - MapLibre GL map instance
 * @param selectedCoords - Selected household coordinates [lng, lat]
 */
export const useSelectedHouseholdSync = (
  map: maplibregl.Map | null,
  selectedCoords?: [number, number] | null
): void => {
  useEffect(() => {
    if (!map) return;

    const source = map.getSource('selected-household') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: selectedCoords
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: selectedCoords,
              },
              properties: { selected: true },
            },
          ]
        : [],
    });
  }, [map, selectedCoords]);
};

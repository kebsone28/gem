/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';

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
  const setDataTimeoutRef = useRef<any>(null);

  const dataHash = useMemo(() => {
    if (householdGeoJSON?.features) {
       // Worker result is already deduplicated
       return `worker:${householdGeoJSON.features.length}`;
    }
    if (households && households.length > 0) {
      // Calculate a fast numeric checksum of versions to detect changes without string joining
      const versionChecksum = households.reduce((sum, h) => sum + (h.version || 0), 0);
      return `fallback:${households.length}:${versionChecksum}`;
    }
    return 'empty:0';
  }, [householdGeoJSON, households]);

  // ── Main GeoJSON Sync ──
  useEffect(() => {
    if (!map) return;

    const applyData = () => {
      if (!map.isStyleLoaded()) return;

      const source = map.getSource('households') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      // Hash unchanged + source was already available = no update needed
      if (dataHash === lastDataHashRef.current) return;
      lastDataHashRef.current = dataHash;

      // Debounce setData to prevent rapid successive updates
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);

      setDataTimeoutRef.current = setTimeout(() => {
        let dataToApply: any;

        if (householdGeoJSON?.features) {
          // ✅ Direct use of worker result (already deduplicated in background thread)
          dataToApply = householdGeoJSON;
        } else if (households && households.length > 0) {
          // Fallback for direct data (rare)
          dataToApply = {
            type: 'FeatureCollection',
            features: households.map((h: any) => {
              // Minimal quick normalization for the fallback using domain tool
              let safeStatus = h.status || 'Non encore installée';
              try {
                // If the string starts with Non, let's roughly classify it if it slips
                const lower = safeStatus.toLowerCase();
                if (lower.includes('début') || lower.includes('debut') || lower.includes('demarr') || lower.includes('démarr') || lower.includes('pending') || lower.includes('install')) {
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
        } else {
          dataToApply = { type: 'FeatureCollection', features: [] };
        }

        source.setData(dataToApply);
        console.log(`🚀 [MapPerformance] Fast-Sync: ${dataToApply.features?.length || 0} pts`);
      }, 16); // 16ms = 1 frame delay (smooth update)
    };

    // Try immediately — style may already be loaded
    applyData();

    // ✅ Retry when style becomes ready (handles race conditions on initial load)
    map.on('styledata', applyData);
    map.on('idle', applyData);

    return () => {
      map.off('styledata', applyData);
      map.off('idle', applyData);
      if (setDataTimeoutRef.current) clearTimeout(setDataTimeoutRef.current);
    };
  }, [map, dataHash, householdGeoJSON, households]);

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

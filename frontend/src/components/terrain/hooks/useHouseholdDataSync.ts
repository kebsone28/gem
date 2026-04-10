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
  const lastDataHashRef = useRef<string>('');
  const lastSourceAvailableRef = useRef<boolean>(false);
  const setDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Deduplicate by numeroordre (household order number) - keep only OLDEST GPS per ménage
   * numeroordre is the immutable identifier, id may differ between old/new GPS records
   */
  const deduplicateKeepOldestGPS = (features: any[]) => {
    const seenNumeros = new Map<string, any>();

    features.forEach((feature) => {
      // Use numeroordre as the identifier, fallback to ID if missing
      const identifier = feature.properties?.numeroordre || feature.properties?.id || feature.id;
      if (!identifier) return;

      // Keep only first occurrence (oldest GPS)
      if (!seenNumeros.has(identifier)) {
        seenNumeros.set(identifier, feature);
      } else {
        console.log(
          `🔄 [Dedup] Ménage ${identifier}: removing newer GPS [${feature.geometry.coordinates}], keeping old [${seenNumeros.get(identifier).geometry.coordinates}]`
        );
      }
    });

    return Array.from(seenNumeros.values());
  };

  /**
   * Lightweight hash instead of JSON.stringify
   * Format: source:count:numeroordre1|numeroordre2|numeroordre3 (using immutable numeroordre)
   */
  const dataHash = useMemo(() => {
    if (householdGeoJSON?.features?.length > 0) {
      const deduplicatedFeatures = deduplicateKeepOldestGPS(householdGeoJSON.features);
      const identifiers = deduplicatedFeatures
        .map((f: any) => f.properties?.numeroordre || f.properties?.id || f.id)
        .sort()
        .join('|');
      return `worker:${deduplicatedFeatures.length}:${identifiers}`;
    }
    if (households && households.length > 0) {
      const numeroordres = households
        .map((h: any) => h.numeroordre || h.id)
        .sort()
        .join('|');
      return `fallback:${households.length}:${numeroordres}`;
    }
    return 'empty:0';
  }, [householdGeoJSON, households]);

  // ── Main GeoJSON Sync ──
  useEffect(() => {
    console.log(
      `🔍 [useHouseholdDataSync] useEffect triggered (dataHash: ${dataHash.substring(0, 30)}...)`
    );

    if (!map) {
      console.log('⏳ [useHouseholdDataSync] No map, skipping');
      return;
    }

    const source = map.getSource('households') as maplibregl.GeoJSONSource | undefined;
    const sourceNowAvailable = !!source;

    if (!source) {
      console.log('⏳ [useHouseholdDataSync] Source not yet available, skipping data sync');
      lastSourceAvailableRef.current = false;
      return;
    }

    // Detect if source just became available (source was unavailable, now available)
    const sourceJustBecameAvailable = !lastSourceAvailableRef.current && sourceNowAvailable;
    lastSourceAvailableRef.current = true;

    // Hash unchanged + source was already available = no update needed
    if (dataHash === lastDataHashRef.current && !sourceJustBecameAvailable) {
      console.log('📊 [useHouseholdDataSync] Data hash unchanged, skipping setData()');
      return;
    }

    if (sourceJustBecameAvailable) {
      console.log('🟢 [useHouseholdDataSync] Source just became available, forcing data sync...');
    }

    console.log('🔵 [useHouseholdDataSync] Data changed, scheduling GeoJSON update...');
    lastDataHashRef.current = dataHash;

    // Debounce setData to prevent rapid successive updates
    if (setDataTimeoutRef.current) {
      clearTimeout(setDataTimeoutRef.current);
    }

    setDataTimeoutRef.current = setTimeout(() => {
      // Prepare data inside timeout to use latest values
      let dataToApply: any;

      if (householdGeoJSON?.features?.length > 0) {
        console.log(
          `🔍 [useHouseholdDataSync] Using householdGeoJSON (${householdGeoJSON.features.length} raw features)`
        );
        // Log first few features for inspection
        householdGeoJSON.features.slice(0, 3).forEach((f: any, i: number) => {
          console.log(
            `  Feature ${i}: id=${f.properties?.id || f.id}, coords=${f.geometry.coordinates}, numeroordre=${f.properties?.numeroordre || 'N/A'}`
          );
        });

        const deduplicated = deduplicateKeepOldestGPS(householdGeoJSON.features);
        console.log(`✅ After dedup: ${deduplicated.length} features`);

        dataToApply = {
          type: 'FeatureCollection',
          features: deduplicated,
        };
      } else if (households && households.length > 0) {
        console.log(
          `🔍 [useHouseholdDataSync] Using households array (${households.length} raw households)`
        );

        // Convert households to features first
        const householdFeatures = households.map((h: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: h.location?.coordinates || [0, 0],
          },
          properties: {
            id: h.id,
            name: h.name || h.owner?.name || 'HH',
            numeroordre: h.numeroordre || h.id,
            status: h.status || 'unknown',
          },
        }));

        // Apply deduplication to households as well
        const deduplicated = deduplicateKeepOldestGPS(householdFeatures);
        console.log(`✅ After dedup: ${deduplicated.length} features`);

        dataToApply = {
          type: 'FeatureCollection',
          features: deduplicated,
        };
      } else {
        dataToApply = { type: 'FeatureCollection', features: [] };
      }

      source.setData(dataToApply);
      console.log(
        `✅ [useHouseholdDataSync] Updated with ${dataToApply.features?.length || 0} features`
      );
    }, 100); // 100ms debounce for setData
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

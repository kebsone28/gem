/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Hook: Style Lifecycle Management
 *
 * Monitors style.load / load events and resets setup flag
 * when the map style reloads (e.g., style switching)
 *
 * @param map - MapLibre GL map instance
 * @param onStyleReady - Callback when style loads
 */
export const useStyleLifecycle = (map: maplibregl.Map | null, onStyleReady: () => void): void => {
  useEffect(() => {
    if (!map) return;

    const handleStyleLoad = () => {
      console.log('✅ [useStyleLifecycle] Style loaded');
      onStyleReady();
    };

    // Listen for style changes
    map.on('style.load', handleStyleLoad);
    map.on('load', handleStyleLoad);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('load', handleStyleLoad);
    };
  }, [map, onStyleReady]);
};

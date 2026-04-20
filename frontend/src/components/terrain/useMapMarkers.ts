/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * useMapMarkers.ts
 *
 * Hook simple pour gérer les marqueurs utilisateur
 */

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

export const useMapMarkers = (userLocation: [number, number] | null) => {
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    // This will be called from the main component's useEffect
    // to have access to mapRef.current
  }, [userLocation]);

  const setupUserMarker = (map: maplibregl.Map, location: [number, number] | null) => {
    if (!location || !location.length) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.zIndex = '9999';
      el.innerHTML = `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_0_3px_rgba(59,130,246,0.5)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>`;

      userMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([location[0], location[1]])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([location[0], location[1]]);
    }
  };

  const cleanup = () => {
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  };

  return { setupUserMarker, cleanup };
};

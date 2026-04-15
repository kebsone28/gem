import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Hook: Household Scintillation Animation
 * 
 * Creates a high-performance pulsing effect for households using MapLibre paint properties.
 * Updates a global pulse factor every frame to animate the glow layers.
 */
export const useHouseholdAnimation = (map: maplibregl.Map | null, styleIsReady: boolean) => {
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!map || !styleIsReady) return;

    const animate = () => {
      const duration = 2000; // 2 seconds pulse
      const elapsed = Date.now() - startTimeRef.current;
      const progress = (elapsed % duration) / duration;
      
      // Sine wave for smooth pulsing (0 to 1)
      const pulseFactor = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
      
      try {
        if (map.getStyle() && map.getLayer('households-glow-layer')) {
          // Animate radius from 10 to 18
          const radius = 10 + pulseFactor * 8;
          // Animate opacity from 0.4 to 0.1
          const opacity = 0.4 - pulseFactor * 0.3;
          
          map.setPaintProperty('households-glow-layer', 'circle-radius', [
            'interpolate', ['linear'], ['zoom'],
            10, radius * 0.5,
            14, radius,
            18, radius * 1.5
          ]);
          map.setPaintProperty('households-glow-layer', 'circle-opacity', opacity);
        }
      } catch (e) {
        // Style might not be ready or layer missing during transition
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [map, styleIsReady]);
};

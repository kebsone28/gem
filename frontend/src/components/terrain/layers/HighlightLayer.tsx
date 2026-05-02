import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTerrainUIStore } from '../../../store/terrainUIStore';

interface HighlightLayerProps {
  map: maplibregl.Map | null;
}

const HighlightLayer: React.FC<HighlightLayerProps> = ({ map }) => {
  const highlightedLocation = useTerrainUIStore((s) => s.highlightedLocation);
  const setHighlightedLocation = useTerrainUIStore((s) => s.setHighlightedLocation);
  const sourceId = 'highlight-source';
  const layerId = 'highlight-layer-pulse';
  const outerLayerId = 'highlight-layer-outer';
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map || !highlightedLocation) {
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
        return;
    }

    const timeout = setTimeout(() => {
        setHighlightedLocation(null);
    }, 60000);

    // Create a custom element for the pulse effect
    const el = document.createElement('div');
    el.className = 'map-highlight-pulse';
    el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="pulse-point"></div>
    `;

    // Add CSS for the pulse if not exists
    if (!document.getElementById('map-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'map-highlight-styles';
        style.innerHTML = `
            .map-highlight-pulse {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                pointer-events: none;
            }
            .pulse-ring {
                position: absolute;
                width: 15px;
                height: 15px;
                border: 3px solid #3b82f6;
                border-radius: 50%;
                animation: map-pulse 2s ease-out infinite;
            }
            .pulse-point {
                width: 10px;
                height: 10px;
                background-color: #3b82f6;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
            }
            @keyframes map-pulse {
                0% { transform: scale(0.5); opacity: 1; }
                100% { transform: scale(3.5); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Create and add the marker
    const marker = new maplibregl.Marker({ element: el })
        .setLngLat(highlightedLocation)
        .addTo(map);

    markerRef.current = marker;

    // Fly to the location
    map.flyTo({
        center: highlightedLocation,
        zoom: 20,
        speed: 1.5,
        curve: 1,
        essential: true
    });

    return () => {
        clearTimeout(timeout);
        if (marker) marker.remove();
    };
  }, [map, highlightedLocation]);

  return null;
};

export default HighlightLayer;

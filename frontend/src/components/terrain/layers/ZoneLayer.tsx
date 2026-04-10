import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';

interface ZoneLayerProps {
    map: maplibregl.Map | null;
    styleIsReady: boolean;
    grappeZonesData: any;
    grappeCentroidsData: any;
    showZones?: boolean;
}

const ZoneLayer: React.FC<ZoneLayerProps> = ({
    map,
    styleIsReady,
    grappeZonesData,
    grappeCentroidsData,
    showZones = true,
}) => {
    // 🏷️ SOURCES
    useEffect(() => {
        if (!map || !styleIsReady || !map.isStyleLoaded()) return;

        const syncSources = () => {
            try {
            if (!map.getSource('grappes')) {
                map.addSource('grappes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            }
            if (!map.getSource('auto-grappes')) {
                map.addSource('auto-grappes', { type: 'geojson', data: grappeZonesData || { type: 'FeatureCollection', features: [] } });
            }
            if (!map.getSource('auto-grappes-centroids')) {
                map.addSource('auto-grappes-centroids', { type: 'geojson', data: grappeCentroidsData || { type: 'FeatureCollection', features: [] } });
            }
            if (!map.getSource('sous-grappes')) {
                map.addSource('sous-grappes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            }
            } catch (err) {
                console.warn('⚠️ Failed to add zone sources - style may not be ready:', err);
            }
        };

        syncSources();
    }, [map, styleIsReady, grappeZonesData, grappeCentroidsData]);

    // 🏷️ DATA SYNC
    useEffect(() => {
        if (!map || !styleIsReady) return;
        const sourceAuto = map.getSource('auto-grappes') as maplibregl.GeoJSONSource | undefined;
        if (sourceAuto && grappeZonesData) sourceAuto.setData(grappeZonesData);

        const sourceCentroids = map.getSource('auto-grappes-centroids') as maplibregl.GeoJSONSource | undefined;
        if (sourceCentroids && grappeCentroidsData) sourceCentroids.setData(grappeCentroidsData);
    }, [map, styleIsReady, grappeZonesData, grappeCentroidsData]);

    // 🏷️ LAYERS
    useEffect(() => {
        if (!map || !styleIsReady || !map.isStyleLoaded()) return;

        const setupLayers = () => {
            try {
            // Auto-Grappes (Generated)
            if (!map.getLayer('auto-grappes-fill')) {
                map.addLayer({
                    id: 'auto-grappes-fill',
                    type: 'fill',
                    source: 'auto-grappes',
                    layout: { visibility: showZones ? 'visible' : 'none' },
                    paint: {
                        'fill-color': [
                            'case',
                            ['==', ['get', 'type'], 'dense'], '#10b981',
                            ['==', ['get', 'type'], 'kmeans'], '#f59e0b',
                            '#3b82f6'
                        ],
                        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.4, 0.1]
                    }
                });
            }

            if (!map.getLayer('auto-grappes-outline')) {
                map.addLayer({
                    id: 'auto-grappes-outline',
                    type: 'line',
                    source: 'auto-grappes',
                    layout: { visibility: showZones ? 'visible' : 'none' },
                    paint: {
                        'line-color': [
                            'case',
                            ['==', ['get', 'type'], 'dense'], '#059669',
                            ['==', ['get', 'type'], 'kmeans'], '#d97706',
                            '#2563eb'
                        ],
                        'line-width': 2,
                        'line-opacity': 0.6
                    }
                });
            }

            if (!map.getLayer('auto-grappes-labels')) {
                map.addLayer({
                    id: 'auto-grappes-labels',
                    type: 'symbol',
                    source: 'auto-grappes-centroids',
                    layout: {
                        visibility: showZones ? 'visible' : 'none',
                        'text-field': ['concat', ['to-string', ['coalesce', ['get', 'name'], 'Zone']], '\n', ['to-string', ['to-number', ['get', 'count'], 0]], ' pts'],
                        'text-size': 11,
                        'text-font': ['Open Sans Bold', 'Inter Bold'],
                        'text-anchor': 'center'
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#0f172a',
                        'text-halo-width': 1.5,
                        'text-opacity': 0.7
                    }
                });
            }
            } catch (err) {
                console.warn('⚠️ Failed to add zone layers - style may not be ready:', err);
            }
        };

        setupLayers();
    }, [map, styleIsReady, showZones]);

    // Update visibility
    useEffect(() => {
        if (!map || !styleIsReady) return;
        ['auto-grappes-fill', 'auto-grappes-outline', 'auto-grappes-labels'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', showZones ? 'visible' : 'none');
            }
        });
    }, [map, showZones, styleIsReady]);

    return null;
};

export default React.memo(ZoneLayer);

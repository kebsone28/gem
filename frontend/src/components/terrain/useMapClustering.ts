/**
 * useMapClustering.ts
 *
 * Hook ultra-performant pour gérer les clusters sur MapLibre
 * - Mise à jour sur zoom + pan (moveend + zoomend)
 * - Débounce via requestAnimationFrame
 * - Cache pour éviter recalculs inutiles
 * - Anti-flicker et sécurité sur sources
 */

import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { getClustersForZoom } from '../../utils/clusteringUtils';
import logger from '../../utils/logger';

export const useMapClustering = (clustererRef: React.MutableRefObject<Supercluster | null>) => {
    const clusterUpdateTimeoutRef = useRef<number | null>(null);

    // Cache zoom + bbox pour éviter recalcul inutile
    const lastZoomRef = useRef<number | null>(null);
    const lastBBoxRef = useRef<[number, number, number, number] | null>(null);

    /**
     * Met à jour les clusters pour la vue actuelle
     */
    const updateClusterDisplay = useCallback((map: maplibregl.Map) => {
        if (!map.isStyleLoaded() || !clustererRef.current) return;

        const zoom = Math.round(map.getZoom());
        const bounds = map.getBounds();
        const bbox: [number, number, number, number] = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ];

        // Skip si zoom + bbox inchangés
        const lastBBox = lastBBoxRef.current;
        if (
            lastZoomRef.current === zoom &&
            lastBBox?.[0] === bbox[0] &&
            lastBBox?.[1] === bbox[1] &&
            lastBBox?.[2] === bbox[2] &&
            lastBBox?.[3] === bbox[3]
        ) {
            return;
        }

        try {
            const clusters = getClustersForZoom(clustererRef.current, bbox, zoom);
            const clustersGeoJSON = {
                type: 'FeatureCollection',
                features: clusters
            };

            const source = map.getSource('supercluster-generated') as maplibregl.GeoJSONSource;
            if (source) source.setData(clustersGeoJSON as any);

            lastZoomRef.current = zoom;
            lastBBoxRef.current = bbox;

            logger.debug(`🔶 Updated clusters for zoom ${zoom}`);
        } catch (error) {
            logger.error('Failed to update Supercluster clusters:', error);
        }
    }, [clustererRef]);

    /**
     * Setup des listeners pour zoom + pan avec debounce ultra-performant
     */
    const setupClusteringEvents = useCallback((map: maplibregl.Map) => {
        const handleViewportChange = () => {
            if (clusterUpdateTimeoutRef.current) cancelAnimationFrame(clusterUpdateTimeoutRef.current);
            clusterUpdateTimeoutRef.current = requestAnimationFrame(() => updateClusterDisplay(map));
        };

        map.on('zoomend', handleViewportChange);
        map.on('moveend', handleViewportChange);

        return () => {
            map.off('zoomend', handleViewportChange);
            map.off('moveend', handleViewportChange);
            if (clusterUpdateTimeoutRef.current) {
                cancelAnimationFrame(clusterUpdateTimeoutRef.current);
                clusterUpdateTimeoutRef.current = null;
            }
        };
    }, [updateClusterDisplay]);

    return { setupClusteringEvents, updateClusterDisplay };
};

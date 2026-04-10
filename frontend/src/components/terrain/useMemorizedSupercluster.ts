/**
 * useMemorizedSupercluster.ts
 * 
 * Hook to memoize Supercluster initialization
 * - Prevents expensive recalculation for identical datasets  
 * - Deep comparison of household data
 * - Only rebuilds when actual point coordinates change
 */

import { useEffect, useRef } from 'react';
import Supercluster from 'supercluster';
import { householdsToGeoJSON, initializeSupercluster } from '../../utils/clusteringUtils';
import logger from '../../utils/logger';

export const useMemorizedSupercluster = (households: any[]) => {
    const superclusterRef = useRef<Supercluster<any> | null>(null);
    const lastHashRef = useRef<string>('');

    // Simple hash of household coordinates to detect actual changes
    const getHouseholdsHash = (data: any[]) => {
        if (!data || data.length === 0) return '';
        
        // Hash only coordinates (location + id) - ignore status changes
        return data
            .slice(0, Math.min(100, data.length)) // Sample first 100 to avoid huge hash operations
            .map(h => `${h.id}:${h.location?.coordinates?.[0]},${h.location?.coordinates?.[1]}`)
            .join('|');
    };

    useEffect(() => {
        if (!households || households.length === 0) {
            superclusterRef.current = null;
            lastHashRef.current = '';
            return;
        }

        const currentHash = getHouseholdsHash(households);
        
        // Only rebuild if coordinates changed (not just status or other properties)
        if (currentHash === lastHashRef.current && superclusterRef.current) {
            logger.log(`⚡ Supercluster unchanged - skipping rebuild`);
            return;
        }

        try {
            lastHashRef.current = currentHash;
            const geoJSON = householdsToGeoJSON(households);
            superclusterRef.current = initializeSupercluster(geoJSON);
            logger.log(`📍 Supercluster rebuilt with ${geoJSON.length} valid points (Source: ${households.length} households)`);
        } catch (error) {
            logger.error('Failed to initialize Supercluster:', error);
            superclusterRef.current = null;
        }
    }, [households]);

    return superclusterRef;
};

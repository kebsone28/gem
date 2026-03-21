import { useEffect, useRef, useState, useCallback } from 'react';
import { formatBboxForAPI, type BoundingBox } from '../utils/viewportLoading';
import apiClient from '../api/client';
import logger from '../utils/logger';

interface UseViewportLoadingOptions {
    enabled?: boolean;
    projectId?: string;
    debounceMs?: number;
    onHouseholdsLoaded?: (households: any[]) => void;
}

export function useViewportLoading(options: UseViewportLoadingOptions = {}) {
    const {
        enabled = true,
        projectId,
        debounceMs = 300,
        onHouseholdsLoaded
    } = options;

    const [visibleHouseholds, setVisibleHouseholds] = useState<any[]>([]);
    const [isLoadingViewport, setIsLoadingViewport] = useState(false);
    const viewportBoundsRef = useRef<BoundingBox | null>(null);
    const lastBboxRef = useRef<string | null>(null);
    const lastHouseholdsRef = useRef<any[]>([]); // ✅ Keep last known data to avoid blanking
    const abortControllerRef = useRef<AbortController | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const onHouseholdsLoadedRef = useRef(onHouseholdsLoaded);
    useEffect(() => {
        onHouseholdsLoadedRef.current = onHouseholdsLoaded;
    }, [onHouseholdsLoaded]);

    // Debounced viewport loader
    const loadPointsForViewport = useCallback(async (bounds: BoundingBox) => {
        if (!enabled || !projectId) return;

        try {
            setIsLoadingViewport(true);
            
            // Cancel previous request if any
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // Format bbox for API: lng1,lat1,lng2,lat2
            const bboxString = formatBboxForAPI(bounds);
            
            // Only load if viewport significantly changed
            if (lastBboxRef.current === bboxString) {
                return;
            }

            logger.debug(`📍 Loading households for viewport: ${bboxString}`);

            // Call API with bbox query
            const response = await apiClient.get(
                `households?project_id=${projectId}&bbox=${bboxString}&limit=5000`,
                { signal: abortControllerRef.current.signal }
            );

            const households = response.data?.households || response.data || [];
            
            // ✅ Only update if we actually got data OR this is a different viewport
            // This prevents blanking the map when API returns empty for a transitional bbox
            if (households.length > 0) {
                lastHouseholdsRef.current = households;
                setVisibleHouseholds(households);
                lastBboxRef.current = bboxString;

                if (onHouseholdsLoadedRef.current) {
                    onHouseholdsLoadedRef.current(households);
                }
            } else if (lastHouseholdsRef.current.length === 0) {
                // Only pass empty array if we never had data (fresh load)
                lastBboxRef.current = bboxString;
                if (onHouseholdsLoadedRef.current) {
                    onHouseholdsLoadedRef.current([]);
                }
            }
            // If new result is empty but we had previous data → keep previous data on map

            logger.debug(`✅ Loaded ${households.length} households for viewport (kept: ${lastHouseholdsRef.current.length})`);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                logger.error('Failed to load viewport households:', error);
            }
        } finally {
            setIsLoadingViewport(false);
        }
    }, [enabled, projectId]); // Removed onHouseholdsLoaded from dependencies

    const updateViewport = useCallback((bounds: BoundingBox) => {
        viewportBoundsRef.current = bounds;
        
        // Debounce the actual load
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            loadPointsForViewport(bounds);
        }, debounceMs);
    }, [loadPointsForViewport, debounceMs]);

    // Cleanup abort controller and timers on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        visibleHouseholds,
        isLoadingViewport,
        viewportBoundsRef,
        updateViewport
    };
}

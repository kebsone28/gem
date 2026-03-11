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
    const [viewportBounds, setViewportBounds] = useState<BoundingBox | null>(null);
    const lastBboxRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

            logger.log(`📍 Loading households for viewport: ${bboxString}`);

            // Call API with bbox query
            const response = await apiClient.get(
                `households?project_id=${projectId}&bbox=${bboxString}&limit=5000`,
                { signal: abortControllerRef.current.signal }
            );

            const households = response.data?.households || response.data || [];
            setVisibleHouseholds(households);
            lastBboxRef.current = bboxString;

            if (onHouseholdsLoaded) {
                onHouseholdsLoaded(households);
            }

            logger.log(`✅ Loaded ${households.length} households for viewport`);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                logger.error('Failed to load viewport households:', error);
            }
        } finally {
            setIsLoadingViewport(false);
        }
    }, [enabled, projectId, onHouseholdsLoaded]);

    const updateViewport = useCallback((bounds: BoundingBox) => {
        setViewportBounds(bounds);
        
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
        viewportBounds,
        updateViewport
    };
}

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

const MAX_CACHE_SIZE = 50;
const OVERLAP_THRESHOLD = 0.6;

function normalizeBbox(bounds: BoundingBox): BoundingBox {
  return {
    lng1: Number(bounds.lng1.toFixed(3)),
    lat1: Number(bounds.lat1.toFixed(3)),
    lng2: Number(bounds.lng2.toFixed(3)),
    lat2: Number(bounds.lat2.toFixed(3)),
  };
}

function bboxArea(bbox: BoundingBox): number {
  return Math.abs((bbox.lng2 - bbox.lng1) * (bbox.lat2 - bbox.lat1));
}

function bboxIntersection(a: BoundingBox, b: BoundingBox): number {
  const minLng = Math.max(a.lng1, b.lng1);
  const minLat = Math.max(a.lat1, b.lat1);
  const maxLng = Math.min(a.lng2, b.lng2);
  const maxLat = Math.min(a.lat2, b.lat2);

  if (minLng >= maxLng || minLat >= maxLat) return 0;

  return (maxLng - minLng) * (maxLat - minLat);
}

function getOverlapRatio(a: BoundingBox, b: BoundingBox): number {
  const intersection = bboxIntersection(a, b);
  const minArea = Math.min(bboxArea(a), bboxArea(b));
  if (!minArea) return 0;
  return intersection / minArea;
}

function isHouseholdEqual(a: any, b: any) {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.updatedAt === b.updatedAt &&
    a.location?.coordinates?.[0] === b.location?.coordinates?.[0] &&
    a.location?.coordinates?.[1] === b.location?.coordinates?.[1]
  );
}

function mergeStable(prev: any[], next: any[]) {
  const prevMap = new Map(prev.map((item) => [item.id, item]));

  return next.map((item) => {
    const old = prevMap.get(item.id);
    if (!old) return item;

    return isHouseholdEqual(old, item) ? old : item;
  });
}

export function useViewportLoading(options: UseViewportLoadingOptions = {}) {
  const { enabled = true, projectId, debounceMs = 500, onHouseholdsLoaded } = options;

  const [visibleHouseholds, setVisibleHouseholds] = useState<any[]>([]);
  const [isLoadingViewport, setIsLoadingViewport] = useState(false);

  const lastBoundsRef = useRef<BoundingBox | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cacheRef = useRef<Map<string, any[]>>(new Map());

  const onHouseholdsLoadedRef = useRef(onHouseholdsLoaded);

  useEffect(() => {
    onHouseholdsLoadedRef.current = onHouseholdsLoaded;
  }, [onHouseholdsLoaded]);

  const loadPointsForViewport = useCallback(
    async (rawBounds: BoundingBox) => {
      if (!enabled || !projectId) return;

      const bounds = normalizeBbox(rawBounds);
      const bboxString = formatBboxForAPI(bounds);

      // Skip if viewport overlap very high
      if (
        lastBoundsRef.current &&
        getOverlapRatio(lastBoundsRef.current, bounds) >= OVERLAP_THRESHOLD
      ) {
        logger.debug('⏭️ Viewport overlap high → skipping reload');
        return;
      }

      // Cache hit
      const cached = cacheRef.current.get(bboxString);
      if (cached) {
        // LRU: Move to end (most recently used)
        cacheRef.current.delete(bboxString);
        cacheRef.current.set(bboxString, cached);

        logger.debug(`📦 Cache hit viewport: ${bboxString}`);
        setVisibleHouseholds((prev) => mergeStable(prev, cached));
        lastBoundsRef.current = bounds;
        onHouseholdsLoadedRef.current?.(cached);
        return;
      }

      try {
        setIsLoadingViewport(true);

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        logger.debug(`🌍 Loading viewport: ${bboxString}`);

        const response = await apiClient.get(
          `households?project_id=${projectId || ''}&bbox=${bboxString}&limit=10000`,
          { signal: abortControllerRef.current.signal }
        );

        const households = response.data?.households || response.data || [];

        // LRU Cache management
        if (cacheRef.current.size >= MAX_CACHE_SIZE) {
          const oldestKey = cacheRef.current.keys().next().value;
          if (oldestKey) {
            cacheRef.current.delete(oldestKey);
          }
        }

        cacheRef.current.set(bboxString, households);

        setVisibleHouseholds((prev) => mergeStable(prev, households));

        lastBoundsRef.current = bounds;

        onHouseholdsLoadedRef.current?.(households);

        logger.debug(`✅ Loaded ${households.length} households`);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          logger.error('Viewport load failed:', error);
        }
      } finally {
        setIsLoadingViewport(false);
      }
    },
    [enabled, projectId]
  );

  const updateViewport = useCallback(
    (bounds: BoundingBox) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        loadPointsForViewport(bounds);
      }, debounceMs);
    },
    [loadPointsForViewport, debounceMs]
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      cacheRef.current.clear();
    };
  }, []);

  return {
    visibleHouseholds,
    isLoadingViewport,
    updateViewport,
  };
}

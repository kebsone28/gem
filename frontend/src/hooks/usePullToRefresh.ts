import { useState, useRef, useCallback, useEffect } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  /** Distance in px to pull before refresh triggers (default: 80) */
  threshold?: number;
  /** Maximum pull distance in px (default: 120) */
  maxPull?: number;
}

interface PullToRefreshReturn {
  /** Pull progress (0–1), useful for styling the indicator */
  pullProgress: number;
  /** Whether we are currently refreshing */
  isRefreshing: boolean;
  /** Props to spread onto the scrollable container */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    style: { touchAction: string };
  };
  /** Reset the pull state manually */
  reset: () => void;
}

/**
 * usePullToRefresh — Pull-to-refresh gesture hook for mobile lists.
 *
 * Attach `containerProps` to a scrollable container.
 * Renders a refresh indicator above the list when pulled down.
 *
 * @example
 * ```tsx
 * const { pullProgress, isRefreshing, containerProps } = usePullToRefresh({
 *   onRefresh: async () => { await fetchData(); },
 * });
 *
 * return (
 *   <div {...containerProps}>
 *     {isRefreshing && <Spinner />}
 *     {items.map(...)}
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshOptions): PullToRefreshReturn {
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const scrollTopCheck = useRef(false);

  const reset = useCallback(() => {
    setPullProgress(0);
    setIsRefreshing(false);
    isPulling.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate if user is at the top of the scroll container
    const target = e.currentTarget as HTMLElement;
    scrollTopCheck.current = target.scrollTop <= 0;
    if (!scrollTopCheck.current) return;

    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || !scrollTopCheck.current || isRefreshing) return;

      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullProgress(0);
        return;
      }

      // Apply resistance for a natural feel
      const progress = Math.min(delta / maxPull, 1);
      setPullProgress(progress);
    },
    [isRefreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || !scrollTopCheck.current) return;
    isPulling.current = false;

    if (pullProgress >= threshold / maxPull && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        reset();
      }
    } else {
      setPullProgress(0);
    }
  }, [pullProgress, threshold, maxPull, isRefreshing, onRefresh, reset]);

  // Reset when component unmounts
  useEffect(() => {
    return () => {
      isPulling.current = false;
    };
  }, []);

  return {
    pullProgress,
    isRefreshing,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      style: { touchAction: 'pan-x' },
    },
    reset,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect, useRef, useMemo } from 'react';
import Supercluster from 'supercluster';
import { householdsToGeoJSON, initializeSupercluster } from '../../utils/clusteringUtils';
import logger from '../../utils/logger';

/**
 * useMemorizedSupercluster.ts
 *
 * PRO SCALE: Hook to memoize Supercluster initialization
 * Prevents expensive recalculation of clusters for identical datasets
 */
export const useMemorizedSupercluster = (households: Record<string, unknown>[]) => {
  const superclusterRef = useRef<Supercluster<
    Record<string, unknown>,
    Record<string, unknown>
  > | null>(null);
  const dataFingerprintRef = useRef<string>('');

  /**
   * Smart Fingerprint: Unique identifier for the dataset state.
   * Based on length + sampling to stay ultra-fast even with 200k points.
   */
  const getFingerprint = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) return 'empty';

    // Quick fingerprint: Length + sampled version sum + sampled locations
    const count = data.length;

    // Sample few key points to detect movements (start, middle, end)
    const samples = [0, Math.floor(count / 2), count - 1]
      .map((idx) => data[idx])
      .filter(Boolean)
      .map((h: any) => `${h.id}:${h.location?.coordinates?.[0] || 0}`)
      .join('|');

    // Sum versions to detect updates (incremental change)
    const versionSum = data.slice(0, 100).reduce((acc, h: any) => acc + (h.version || 1), 0);

    return `${count}:${versionSum}:${samples}`;
  };

  useEffect(() => {
    if (!households || households.length === 0) {
      superclusterRef.current = null;
      dataFingerprintRef.current = 'empty';
      return;
    }

    const currentFingerprint = getFingerprint(households);

    // ✅ Skip heavy rebuild if data hasn't structurally changed
    if (currentFingerprint === dataFingerprintRef.current && superclusterRef.current) {
      return;
    }

    try {
      dataFingerprintRef.current = currentFingerprint;

      // ✅ Step 1: GeoJSON conversion
      const geoJSON = householdsToGeoJSON(households as any);

      // ✅ Step 2: Supercluster Load (Optimized inside clusteringUtils)
      superclusterRef.current = initializeSupercluster(geoJSON as any);

      logger.log(
        `📍 Supercluster rebuilt [${geoJSON.length} pts] (Source: ${households.length} total)`
      );
    } catch (error) {
      logger.error('Failed to initialize Supercluster:', error);
      superclusterRef.current = null;
    }
  }, [households]);

  return superclusterRef;
};

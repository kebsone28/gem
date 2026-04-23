/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useMapMemoization.ts
 *
 * Custom hooks for efficient map data memoization
 * - Deep GeoJSON memoization with hashing
 * - Prevents recalculations for large datasets
 */

import { useMemo } from 'react';
import { hashGeoJSON } from './mapUtils';

/**
 * Deep memoization hook for GeoJSON data
 * Uses hashing to detect deep changes instead of just reference equality
 *
 * Performance improvement on 50k+ points:
 * - Regular useMemo: recalculates every time props change
 * - useMemoDeep: only recalculates when data hash changes
 */
export const useMemoDeep = <T>(factory: () => T, deps: any[]): T => {
  const depsHash = hashDependencies(deps);

  // preserve-manual-memoization: intentional deep-hash dependency
  // eslint-disable-next-line react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps
  return useMemo(() => factory(), [depsHash]);
};

/**
 * Combine multiple dependencies for efficient comparisons
 */
export const hashDependencies = (deps: any[]): string => {
  return deps.map((dep) => hashGeoJSON(dep)).join('|');
};

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * useMapMemoization.ts
 *
 * Custom hooks for efficient map data memoization
 * - Deep GeoJSON memoization with hashing
 * - Prevents recalculations for large datasets
 */

import { useMemo, useRef } from 'react';
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
  const memoRef = useRef<{ value: T; hash: string }>({
    value: factory(),
    hash: hashGeoJSON(factory()),
  });

  return useMemo(() => {
    const newValue = factory();
    const newHash = hashGeoJSON(newValue);

    // Only update if hash changed (deep comparison)
    if (newHash !== memoRef.current.hash) {
      memoRef.current = { value: newValue, hash: newHash };
    }

    return memoRef.current.value;
  }, [JSON.stringify(deps)]); // deps comparison fallback
};

/**
 * Combine multiple dependencies for efficient comparisons
 */
export const hashDependencies = (deps: any[]): string => {
  return deps.map((dep) => hashGeoJSON(dep)).join('|');
};

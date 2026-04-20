/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Feature, Point } from 'geojson';
import logger from '../utils/logger';

/**
 * useSuperclusterWorker.ts (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Communication asynchrone avec le WebWorker pour le clustering massif.
 */
export const useSuperclusterWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const callbacksRef = useRef<Record<string, (data: any) => void>>({});

  useEffect(() => {
    // Initialisation du worker (Vite syntax)
    const worker = new Worker(new URL('../workers/supercluster.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'LOADED') {
        setIsLoaded(true);
        return;
      }

      if (type === 'CLUSTERS_DATA' || type === 'LEAVES_DATA' || type === 'EXPANSION_ZOOM_DATA') {
        const requestId = payload.requestId || 'default';
        if (callbacksRef.current[requestId]) {
          callbacksRef.current[requestId](payload);
          // Nettoyage si ce n'est pas un flux continu
          if (type !== 'CLUSTERS_DATA') delete callbacksRef.current[requestId];
        }
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const loadPoints = useCallback((points: Feature<Point>[], options = {}) => {
    if (!workerRef.current) return;
    setIsLoaded(false);
    workerRef.current.postMessage({
      type: 'LOAD_POINTS',
      payload: { points, options },
    });
  }, []);

  const getClusters = useCallback(
    (
      bbox: [number, number, number, number],
      zoom: number,
      callback: (clusters: Record<string, unknown>[]) => void
    ) => {
      if (!workerRef.current || !isLoaded) return;
      const requestId = `clusters_${zoom}`;
      callbacksRef.current[requestId] = (payload) => callback(payload.clusters);

      workerRef.current.postMessage({
        type: 'GET_CLUSTERS',
        payload: { bbox, zoom, requestId },
      });
    },
    [isLoaded]
  );

  const getLeaves = useCallback(
    (clusterId: number, limit: number = Infinity): Promise<any[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isLoaded) return resolve([]);
        const requestId = `leaves_${clusterId}_${Date.now()}`;
        callbacksRef.current[requestId] = (payload) => resolve(payload.leaves);

        workerRef.current.postMessage({
          type: 'GET_LEAVES',
          payload: { clusterId, limit, requestId },
        });
      });
    },
    [isLoaded]
  );

  return { loadPoints, getClusters, getLeaves, isLoaded };
};

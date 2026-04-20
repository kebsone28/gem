/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect, useMemo, useState } from 'react';
import type { Household } from '../utils/types';

export const useGrappeClustering = (households: Household[] | undefined) => {
  const [grappeClusters, setGrappeClusters] = useState<any[]>([]);
  const [grappeZonesData, setGrappeZonesData] = useState<any>(null);
  const [grappeCentroidsData, setGrappeCentroidsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clusterWorker = useMemo(
    //@ts-ignore - Vite specific URL syntax
    () => new Worker(new URL('../workers/clusterWorker.ts', import.meta.url), { type: 'module' }),
    []
  );

  useEffect(() => {
    if (!households || households.length === 0) return;

    const timer = setTimeout(() => {
      setIsLoading(true);

      clusterWorker.onmessage = (e) => {
        const data = e.data;
        if (data && data.success) {
          setGrappeClusters(data.panelData);
          setGrappeZonesData(data.zones);
          setGrappeCentroidsData(data.centroids);
          setIsLoading(false);
        }
      };

      const workerData = households
        .filter((h: any) => {
          const lng = Number(h.location?.coordinates?.[0] ?? h.longitude);
          const lat = Number(h.location?.coordinates?.[1] ?? h.latitude);
          return !isNaN(lng) && !isNaN(lat) && (lng !== 0 || lat !== 0);
        })
        .map((h: any) => ({
          id: h.id,
          lat: Number(h.location?.coordinates?.[1] ?? h.latitude),
          lon: Number(h.location?.coordinates?.[0] ?? h.longitude),
          village: h.village || h.departement || '',
          region: h.region || '',
          status: h.status,
          owner: h.owner,
          name: h.name,
          phone: h.phone,
          location: h.location,
        }));

      clusterWorker.postMessage({ households: workerData, maxPerCluster: 80 });
    }, 300);

    return () => clearTimeout(timer);
  }, [households, clusterWorker]);

  useEffect(() => {
    return () => {
      clusterWorker.terminate();
    };
  }, [clusterWorker]);

  return { grappeClusters, grappeZonesData, grappeCentroidsData, isLoading };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import type { Household } from '../utils/types';

type ClusterWorkerMessage = {
  success?: boolean;
  panelData?: any[];
  zones?: unknown;
  centroids?: unknown;
};

export const useGrappeClustering = (households: Household[] | undefined) => {
  const [grappeClusters, setGrappeClusters] = useState<any[]>([]);
  const [grappeZonesData, setGrappeZonesData] = useState<any>(null);
  const [grappeCentroidsData, setGrappeCentroidsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clusterWorker = useMemo(
    () => new Worker(new URL('../workers/clusterWorker.ts', import.meta.url), { type: 'module' }),
    []
  );

  useEffect(() => {
    if (!households || households.length === 0) return;

    let isCancelled = false;
    let handler: ((e: MessageEvent<ClusterWorkerMessage>) => void) | null = null;

    const timer = setTimeout(() => {
      if (isCancelled) return;

      setIsLoading(true);

      handler = (e: MessageEvent<ClusterWorkerMessage>) => {
        if (isCancelled) return;
        const data = e.data;
        if (data && data.success) {
          setGrappeClusters(data.panelData || []);
          setGrappeZonesData(data.zones);
          setGrappeCentroidsData(data.centroids);
          setIsLoading(false);
        }
      };

      clusterWorker.addEventListener('message', handler);

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

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (handler) {
        clusterWorker.removeEventListener('message', handler);
      }
    };
  }, [households, clusterWorker]);

  useEffect(() => {
    return () => {
      clusterWorker.terminate();
    };
  }, [clusterWorker]);

  const hasHouseholds = Boolean(households && households.length > 0);

  return {
    grappeClusters: hasHouseholds ? grappeClusters : [],
    grappeZonesData: hasHouseholds ? grappeZonesData : null,
    grappeCentroidsData: hasHouseholds ? grappeCentroidsData : null,
    isLoading: hasHouseholds ? isLoading : false,
  };
};

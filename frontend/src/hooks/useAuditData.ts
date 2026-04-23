/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import type { Household } from '../utils/types';

export const buildAuditWorkerData = (households: Household[] | undefined) => {
  if (!households || households.length === 0) return [];

  return households
    .filter(
      (h: any) =>
        h.location?.coordinates &&
        !isNaN(Number(h.location.coordinates[0])) &&
        !isNaN(Number(h.location.coordinates[1]))
    )
    .map((h: any) => ({
      id: h.id,
      lat: Number(h.location.coordinates[1]),
      lon: Number(h.location.coordinates[0]),
      village: h.village || h.departement || '',
      region: h.region || '',
      status: h.status,
      owner: h.owner,
      name: h.name,
      phone: h.phone,
      location: h.location,
    }));
};

export const useAuditData = (households: Household[] | undefined) => {
  const [auditResult, setAuditResult] = useState<any>(null);

  const auditWorker = useMemo(
    // @ts-expect-error - Vite specific URL syntax
    () => new Worker(new URL('../workers/dataAuditWorker.ts', import.meta.url), { type: 'module' }),
    []
  );

  useEffect(() => {
    if (!households || households.length === 0) return;

    const handler = (e: MessageEvent) => {
      if ((e.data as any)?.type === 'AUDIT_RESULT') {
        setAuditResult((e.data as any).result);
      }
    };

    auditWorker.addEventListener('message', handler);

    const workerData = households
      .filter(
        (h: any) =>
          h.location?.coordinates &&
          !isNaN(Number(h.location.coordinates[0])) &&
          !isNaN(Number(h.location.coordinates[1]))
      )
      .map((h: any) => ({
        id: h.id,
        lat: Number(h.location.coordinates[1]),
        lon: Number(h.location.coordinates[0]),
        village: h.village || h.departement || '',
        region: h.region || '',
        status: h.status,
        owner: h.owner,
        name: h.name,
        phone: h.phone,
        location: h.location,
      }));

    auditWorker.postMessage({ households: workerData });

    return () => {
      auditWorker.removeEventListener('message', handler);
    };
  }, [households, auditWorker]);

  useEffect(() => {
    return () => {
      auditWorker.terminate();
    };
  }, [auditWorker]);

  return { auditResult };
};

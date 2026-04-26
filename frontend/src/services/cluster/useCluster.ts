import { useEffect, useRef, useState, useCallback } from 'react';

type WorkerResponse = {
  type: string;
  requestId?: string;
  clusters?: any[];
  leaves?: any[];
  zoom?: number;
};

export function useCluster() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  const pending = useRef(new Map<string, (val: any) => void>());

  useEffect(() => {
    try {
      const worker = new Worker(new URL('../../workers/supercluster.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
        const msg = ev.data;
        if (msg.type === 'ready') setReady(true);
        if (msg.type === 'loaded') {
          // loaded ack
          return;
        }
        if (msg.type === 'clusters') {
          setClusters(msg.clusters || []);
          if (msg.requestId && pending.current.has(msg.requestId)) {
            pending.current.get(msg.requestId)!(msg.clusters || []);
            pending.current.delete(msg.requestId);
          }
          return;
        }
        if (msg.type === 'leaves') {
          if (msg.requestId && pending.current.has(msg.requestId)) {
            pending.current.get(msg.requestId)!(msg.leaves || []);
            pending.current.delete(msg.requestId);
          }
          return;
        }
        if (msg.type === 'expansionZoom') {
          if (msg.requestId && pending.current.has(msg.requestId)) {
            pending.current.get(msg.requestId)!(msg.zoom ?? null);
            pending.current.delete(msg.requestId);
          }
          return;
        }
        if (msg.type === 'error') {
          if (msg.requestId && pending.current.has(msg.requestId)) {
            pending.current.get(msg.requestId)!({ error: true, message: (msg as any).message });
            pending.current.delete(msg.requestId);
          }
        }
      };

      worker.postMessage({ type: 'init', options: { radius: 60, maxZoom: 16 } });
    } catch (e) {
      console.error('Worker init failed', e);
    }
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const load = useCallback((points: any[]) => {
    workerRef.current?.postMessage({ type: 'load', points });
  }, []);

  const getClusters = useCallback(
    (bbox: [number, number, number, number], zoom: number): Promise<any[]> => {
      return new Promise((resolve) => {
        const requestId = Math.random().toString(36).slice(2);
        pending.current.set(requestId, resolve);
        workerRef.current?.postMessage({ type: 'getClusters', bbox, zoom, requestId });
        setTimeout(() => {
          if (pending.current.has(requestId)) {
            pending.current.delete(requestId);
            resolve([]);
          }
        }, 5000);
      });
    },
    []
  );

  const getLeaves = useCallback((clusterId: number, limit = 500, offset = 0): Promise<any[]> => {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pending.current.set(requestId, resolve);
      workerRef.current?.postMessage({ type: 'getLeaves', clusterId, limit, offset, requestId });
      setTimeout(() => {
        if (pending.current.has(requestId)) {
          pending.current.delete(requestId);
          resolve([]);
        }
      }, 8000);
    });
  }, []);

  const getClusterExpansionZoom = useCallback((clusterId: number): Promise<number | null> => {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pending.current.set(requestId, resolve);
      workerRef.current?.postMessage({ type: 'getClusterExpansionZoom', clusterId, requestId });
      setTimeout(() => {
        if (pending.current.has(requestId)) {
          pending.current.delete(requestId);
          resolve(null);
        }
      }, 5000);
    });
  }, []);

  return { ready, clusters, load, getClusters, getLeaves, getClusterExpansionZoom };
}

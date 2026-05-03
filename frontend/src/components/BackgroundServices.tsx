 
/**
 * BackgroundServices
 * Thin bridge component — the ONLY reason this still exists as a React component
 * is that useLiveQuery (Dexie) requires a React context to subscribe.
 * All actual sync logic lives in services/sync/backgroundSyncService.ts.
 *
 * Responsibility: watch Dexie pendingCount live → push to syncStore.
 */
import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { updatePendingCount } from '../services/sync/syncService';
import {
  flushInternalKoboSubmissionQueue,
  reportInternalKoboClientQueue,
} from '../services/internalKoboSubmissionService';

export default function BackgroundServices() {
  const pendingCount = useLiveQuery(
    () => db.syncOutbox.where({ status: 'pending' }).count(),
    [],
    0
  );
  const internalKoboQueueCount = useLiveQuery(async () => {
    const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
    return queuedItems.filter((item) => item.action === 'internal-kobo-submit').length;
  }, [], 0);
  const isFlushingInternalKoboRef = useRef(false);
  const lastQueueReportAtRef = useRef(0);

  useEffect(() => {
    if (pendingCount !== undefined) {
      updatePendingCount(pendingCount);
    }
  }, [pendingCount]);

  useEffect(() => {
    if (!internalKoboQueueCount) return undefined;

    let timeoutId: number | undefined;
    const canFlush = () =>
      typeof navigator === 'undefined' || navigator.onLine !== false;

    const flush = async () => {
      if (isFlushingInternalKoboRef.current || !canFlush()) return;
      isFlushingInternalKoboRef.current = true;

      try {
        const result = await flushInternalKoboSubmissionQueue();
        window.dispatchEvent(new CustomEvent('internal-kobo:queue-flushed', { detail: result }));
        const now = Date.now();
        if (now - lastQueueReportAtRef.current > 60_000) {
          lastQueueReportAtRef.current = now;
          reportInternalKoboClientQueue().catch(() => undefined);
        }
      } catch (error) {
        window.dispatchEvent(new CustomEvent('internal-kobo:queue-flush-error', { detail: error }));
      } finally {
        isFlushingInternalKoboRef.current = false;
      }
    };

    const scheduleFlush = () => {
      if (!canFlush()) return;
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(flush, 1500);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleFlush();
    };

    scheduleFlush();
    window.addEventListener('online', scheduleFlush);
    window.addEventListener('focus', scheduleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener('online', scheduleFlush);
      window.removeEventListener('focus', scheduleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [internalKoboQueueCount]);

  useEffect(() => {
    if (!internalKoboQueueCount) return undefined;
    const report = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const now = Date.now();
      if (now - lastQueueReportAtRef.current < 60_000) return;
      lastQueueReportAtRef.current = now;
      reportInternalKoboClientQueue().catch(() => undefined);
    };
    const timeoutId = window.setTimeout(report, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [internalKoboQueueCount]);

  return null;
}

import React, { useEffect, useRef, useCallback } from 'react';
import { useSyncStore } from '../store/syncStore';
import toast from 'react-hot-toast';
import { Bell, CloudDownload } from 'lucide-react';

/**
 * SyncNotification
 * Reads pending count from syncStore — no local sync logic.
 * Shows a toast when items get synced (count decreases).
 */
export const SyncNotification: React.FC = () => {
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSyncedToast = useCallback((syncedCount: number) => {
    toast.custom(
      (t) => (
        <div
          className={`transform transition-all ${
            t.visible
              ? 'animate-in slide-in-from-top-4 fade-in'
              : 'animate-out slide-out-to-top-4 fade-out'
          }`}
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-6 py-4 shadow-2xl shadow-indigo-500/30 max-w-md border border-indigo-400/20 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur">
                <CloudDownload className="w-6 h-6 text-white animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-base tracking-tight">
                  {syncedCount} changement{syncedCount > 1 ? 's' : ''} synchronisé
                  {syncedCount > 1 ? 's' : ''}
                </p>
                <p className="text-indigo-200 text-sm font-medium mt-0.5">
                  Données mises à jour avec le cloud.
                </p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10">
                <Bell className="w-4 h-4 text-indigo-200" />
              </div>
            </div>
          </div>
        </div>
      ),
      { position: 'top-center', duration: 4000 }
    );
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const prev = lastCountRef.current;
      if (pendingCount < prev && prev > 0) {
        showSyncedToast(prev - pendingCount);
      }
      lastCountRef.current = pendingCount;
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingCount, showSyncedToast]);

  return null;
};

export default SyncNotification;

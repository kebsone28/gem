/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useEffect } from 'react';
import { db } from '../store/db';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * SyncAlertBanner — Shows a dismissable warning banner when
 * the last sync is older than 24 hours, or if there has never been a sync.
 * Only shown to ADMIN_PROQUELEC and DG_PROQUELEC.
 */
export default function SyncAlertBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [hoursSince, setHoursSince] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !['ADMIN_PROQUELEC', 'DG_PROQUELEC'].includes(user.role)) return;
    if (dismissed) return;

    const check = async () => {
      const lastLog = await db.sync_logs.orderBy('id').last();
      if (!lastLog) {
        setHoursSince(null);
        setShow(true);
        return;
      }
      const diffMs = Date.now() - new Date(lastLog.timestamp).getTime();
      const hours = Math.floor(diffMs / 3_600_000);
      if (hours >= 24) {
        setHoursSince(hours);
        setShow(true);
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // re-check every 5 min
    return () => clearInterval(interval);
  }, [user, dismissed]);

  if (!show || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-amber-500 text-white text-[13px] font-bold shadow-lg z-50 shrink-0">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">
        {hoursSince !== null
          ? `⚠ Dernière synchronisation Kobo il y a ${hoursSince}h — les données terrain peuvent être obsolètes.`
          : '⚠ Aucune synchronisation Kobo détectée — cliquez SYNCHRONISER pour charger les données.'}
      </span>
      <button
        onClick={() => {
          navigate('/dashboard');
          setDismissed(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900/20 hover:bg-white dark:bg-slate-900/30 rounded-lg transition-all text-xs"
      >
        <RefreshCw size={12} /> Sync maintenant
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-white dark:bg-slate-900/20 rounded-lg transition-all"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

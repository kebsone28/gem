import { useMemo } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineStore } from '../store/offlineStore';

/**
 * OfflineBanner
 * Reads from offlineStore — zero local state, zero event listeners.
 * All network detection is handled by offlineService (initialized in main.tsx).
 */
export default function OfflineBanner() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const showReconnected = useOfflineStore((s) => s.showReconnected);

  const bannerVariants = useMemo(
    () => ({
      initial: { y: -50, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: -50, opacity: 0 },
    }),
    []
  );

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline"
          {...bannerVariants}
          className="fixed top-0 left-0 right-0 z-[9999] bg-danger text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-lg"
        >
          <WifiOff size={14} />
          <span>MODE HORS-LIGNE — Les données seront synchronisées ultérieurement</span>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          key="reconnected"
          {...bannerVariants}
          className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-lg"
        >
          <Wifi size={14} />
          <span>CONNEXION RÉTABLIE — Synchronisation en cours...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

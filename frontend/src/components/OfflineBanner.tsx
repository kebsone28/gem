import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 5000);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] bg-danger text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-lg"
                >
                    <WifiOff size={14} />
                    <span>MODE HORS-LIGNE — Les données seront synchronisées ultérieurement</span>
                </motion.div>
            )}

            {showReconnected && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-500 text-white py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-lg"
                >
                    <Wifi size={14} />
                    <span>CONNEXION RÉTABLIE — Synchronisation en cours...</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

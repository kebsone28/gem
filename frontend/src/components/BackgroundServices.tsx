import { useEffect } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import logger from '../utils/logger';

export default function BackgroundServices() {
    const { pendingCount, syncData } = useOfflineSync();

    useEffect(() => {
        // 1. Sync when pending count changes
        if (pendingCount > 0) {
            // Debounce the sync to avoid rapid re-triggering
            const timer = setTimeout(() => {
                logger.log(`📈 [SYNC SERVICE] Pending items (${pendingCount}). Syncing...`);
                syncData();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [pendingCount, syncData]);

    useEffect(() => {
        // 2. Handle manual force-sync events from the UI and online events
        const handleForceSync = () => {
            logger.log('⚡ [SYNC SERVICE] Forced sync event received');
            syncData();
        };
        const handleOnline = () => {
            logger.log('🌐 [SYNC SERVICE] Network restored. Triggering sync...');
            syncData();
        };
        
        window.addEventListener('sync:force', handleForceSync);
        window.addEventListener('online', handleOnline);
        
        // 3. Periodic full sync (pull) every 5 minutes
        const interval = setInterval(() => {
            logger.log('🕒 [SYNC SERVICE] Periodic full sync cycle');
            syncData();
        }, 5 * 60 * 1000);

        return () => {
            window.removeEventListener('sync:force', handleForceSync);
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, [syncData]);

    return null;
}

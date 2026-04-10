/**
 * Offline Service
 * Pure module — NO React dependency.
 * Manages online/offline state and updates offlineStore directly.
 * Initialized once in main.tsx and runs for the lifetime of the app.
 */

import { logger } from '../logger';
import { useOfflineStore } from '../../store/offlineStore';

type CleanupFn = () => void;

let _initialized = false;
let _cleanup: CleanupFn | null = null;

/** Detect Network Information API connection type */
function detectConnectionType(): 'wifi' | 'cellular' | 'unknown' {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return 'unknown';
    const type: string = conn.effectiveType || conn.type || '';
    if (type.includes('wifi') || type === '4g' || type === 'ethernet') return 'wifi';
    if (type.includes('cellular') || type === '2g' || type === '3g') return 'cellular';
    return 'unknown';
}

function syncStoreFromNavigator() {
    const store = useOfflineStore.getState();
    const isOnline = navigator.onLine;
    store.setOnlineStatus(isOnline);
    store.setConnectionType(detectConnectionType());
    if (isOnline) {
        store.setLastOnlineAt(Date.now());
    }
}

/**
 * Initialize the offline listener.
 * Safe to call in main.tsx — idempotent.
 */
export function initOfflineListener(): CleanupFn {
    if (_initialized) {
        logger.warn('OFFLINE', 'initOfflineListener called more than once — skipping');
        return _cleanup ?? (() => {});
    }
    _initialized = true;

    logger.info('OFFLINE', 'Initializing offline listener');

    // Set initial state from browser
    syncStoreFromNavigator();

    const handleOnline = () => {
        logger.info('OFFLINE', 'Network restored');
        const store = useOfflineStore.getState();
        store.setOnlineStatus(true);
        store.setLastOnlineAt(Date.now());
        store.setShowReconnected(true);
        store.setConnectionType(detectConnectionType());

        // Auto-hide reconnected banner after 5s
        setTimeout(() => {
            useOfflineStore.getState().setShowReconnected(false);
        }, 5000);

        // Trigger a sync cycle on reconnect
        window.dispatchEvent(new CustomEvent('sync:force'));
    };

    const handleOffline = () => {
        logger.warn('OFFLINE', 'Network lost');
        const store = useOfflineStore.getState();
        store.setOnlineStatus(false);
        store.setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    _cleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        _initialized = false;
        logger.info('OFFLINE', 'Offline listener destroyed');
    };

    return _cleanup;
}

/** Expose for tests */
export function _reset() {
    if (_cleanup) _cleanup();
    _cleanup = null;
    _initialized = false;
}

import React, { useEffect, useState } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import toast from 'react-hot-toast';
import { Bell, CloudDownload } from 'lucide-react';

export const SyncNotification: React.FC = () => {
    const { pendingCount } = useOfflineSync();
    const [lastCount, setLastCount] = useState(0);

    useEffect(() => {
        // Debounce logic: wait for sync to settle before showing summary
        const timer = setTimeout(() => {
            if (pendingCount < lastCount && lastCount > 0) {
                const syncedCount = lastCount - pendingCount;
                
                toast.custom((t) => (
                    <div className={`transform transition-all ${
                        t.visible ? 'animate-in slide-in-from-top-4 fade-in' : 'animate-out slide-out-to-top-4 fade-out'
                    }`}>
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-6 py-4 shadow-2xl shadow-indigo-500/30 max-w-md border border-indigo-400/20 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur">
                                    <CloudDownload className="w-6 h-6 text-white animate-bounce" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-black text-base tracking-tight">
                                        {syncedCount} changement{syncedCount > 1 ? 's' : ''} synchronisé{syncedCount > 1 ? 's' : ''}
                                    </p>
                                    <p className="text-indigo-200 text-sm font-medium mt-0.5">
                                        Données mises à jour avec le cloud.
                                    </p>
                                </div>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5">
                                    <Bell className="w-4 h-4 text-indigo-200" />
                                </div>
                            </div>
                        </div>
                    </div>
                ), {
                    position: 'top-center',
                    duration: 4000
                });
                
                // Once shown and settled, sync lastCount
                setLastCount(pendingCount);
            } else {
                // If count increased or stayed same, just update lastCount quietly
                setLastCount(pendingCount);
            }
        }, 2000); // Wait 2s of inactivity

        return () => clearTimeout(timer);
    }, [pendingCount, lastCount]);

    return null;
};

export default SyncNotification;

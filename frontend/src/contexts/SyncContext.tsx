import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';
import { db, syncData } from '../store/db';

interface SyncContextType {
    isSyncing: boolean;
    syncStatus: 'idle' | 'syncing' | 'error' | 'success';
    lastSync: string | null;
    pendingChanges: number;
    sync: (projectId?: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
    const [lastSync, setLastSync] = useState<string | null>(safeStorage.getItem('last_sync_timestamp'));
    const lastSyncRef = useRef<string | null>(safeStorage.getItem('last_sync_timestamp'));
    const [pendingChanges, setPendingChanges] = useState(0);
    const syncInProgressRef = useRef(false);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Query pending changes count
    useEffect(() => {
        const checkPendingCount = async () => {
            const count = await (db as any).syncOutbox.where({ status: 'pending' }).count();
            setPendingChanges(count);
        };
        checkPendingCount();
        const interval = setInterval(checkPendingCount, 5000);
        return () => clearInterval(interval);
    }, []);

    const sync = useCallback(async (projectId?: string) => {
        // Prevention and optimization
        if (syncInProgressRef.current) {
            logger.warn('⚠️ Sync already in progress');
            return;
        }

        const token = safeStorage.getItem('access_token');
        if (!token || !navigator.onLine) return;

        // ✅ CRITICAL OPTIMIZATION #1: Check pending changes
        const pendingCount = await (db as any).syncOutbox.where({ status: 'pending' }).count();
        
        // If no pending changes and we already have a sync timestamp, we might skip push but we still want to pull periodically
        // However, if the user manually triggered sync, we force it.
        
        syncInProgressRef.current = true;
        setIsSyncing(true);
        setSyncStatus('syncing');

        try {
            // 1. PUSH local changes
            if (pendingCount > 0) {
                logger.log(`📤 [SYNC] Pushing ${pendingCount} pending changes...`);
                let households: any[] = [];
                if (projectId) {
                    households = await (db as any).households
                        .where('projectId').equals(projectId)
                        .toArray()
                        .catch(() => []);
                }

                const projects = await db.projects.toArray();
                const zones = await db.zones.toArray();
                const teams = await db.teams.toArray();
                const inventory = await (db as any).inventory?.toArray() || [];
                const expenses = await (db as any).expenses?.toArray() || [];

                try {
                    await apiClient.post('sync/push', {
                        timestamp: lastSyncRef.current,
                        changes: {
                            projects,
                            households,
                            zones,
                            teams,
                            inventory,
                            expenses,
                            missions: await (db as any).missions?.toArray() || []
                        }
                    });
                } catch (pushErr) {
                    logger.warn('Push sync failed, continuing with pull...', pushErr);
                }
            }

            // 2. PULL server changes
            logger.log('📥 [SYNC] Pulling server changes...');
            const response = await apiClient.get('sync/pull', {
                params: {
                    since: lastSyncRef.current,
                    projectId: projectId || undefined,
                    limit: 1000
                }
            });

            const { timestamp, changes } = response.data;

            // Apply changes with chunking
            if (changes.projects) await syncData('projects', changes.projects);

            if (changes.households && changes.households.length > 0) {
                logger.log(`📥 Applying ${changes.households.length} household changes...`);
                const chunkSize = 500;
                for (let i = 0; i < changes.households.length; i += chunkSize) {
                    const chunk = changes.households.slice(i, i + chunkSize);
                    await syncData('households', chunk);
                }
            }

            if (changes.zones) await syncData('zones', changes.zones);
            if (changes.teams) await syncData('teams', changes.teams);
            if (changes.inventory) await syncData('inventory', changes.inventory);
            if (changes.expenses) await syncData('expenses', changes.expenses);
            if (changes.missions) await syncData('missions', changes.missions);

            // Update sync timestamp (using ref to avoid callback re-creation loop)
            lastSyncRef.current = timestamp;
            setLastSync(timestamp); 
            safeStorage.setItem('last_sync_timestamp', timestamp);
            setSyncStatus('success');

            // Log successful sync
            await db.sync_logs.add({
                timestamp: new Date(),
                action: `Synchronisation réussie (${changes.households?.length || 0} ménages, ${pendingCount} envoyés)`,
                details: { timestamp, changes: Object.keys(changes) }
            });

            logger.log('✅ [SYNC] Sync completed successfully');
            setPendingChanges(0);

            // Return to idle after 3s
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (error) {
            logger.error('Sync failed:', error);
            setSyncStatus('error');
        } finally {
            syncInProgressRef.current = false;
            setIsSyncing(false);
        }
    }, []); // Empty dependencies = stable callback identity

    // ✅ CRITICAL OPTIMIZATION #1: Auto-sync only if user authenticated and has pending changes
    useEffect(() => {
        if (!user) return;

        const performAutoSync = async () => {
            if (!navigator.onLine) return;
            await sync();
        };

        // Initial sync on mount
        performAutoSync();

        // Then sync every 30s ONLY if pending changes exist
        syncIntervalRef.current = setInterval(async () => {
            const pendingCount = await (db as any).syncOutbox.where({ status: 'pending' }).count();
            if (pendingCount > 0) {
                performAutoSync();
            }
        }, 30000);

        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [user, sync]);

    return (
        <SyncContext.Provider
            value={{
                isSyncing,
                syncStatus,
                lastSync,
                pendingChanges,
                sync
            }}
        >
            {children}
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
};

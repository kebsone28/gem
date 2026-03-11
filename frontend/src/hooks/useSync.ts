import { useState, useCallback, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { db, syncData } from '../store/db';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import { optimizeMemory } from '../utils/memoryOptimizer';


export function useSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);
    const lastSyncRef = useRef(safeStorage.getItem('last_sync_timestamp'));
    const [lastSync, setLastSyncState] = useState<string | null>(lastSyncRef.current);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');

    const sync = useCallback(async (projectId?: string, isAuto = false) => {
        if (isSyncingRef.current) return;

        const token = safeStorage.getItem('access_token');
        if (!token) return;

        isSyncingRef.current = true;
        setIsSyncing(true);
        setSyncStatus('syncing');

        try {
            // 1. PUSH local changes - only for active project to avoid memory overload
            const projects = await db.projects.toArray();
            let households: any[] = [];
            
            // Only push households from active project to avoid memory issues
            if (projectId) {
                households = await (db as any).households
                    .where('projectId').equals(projectId)
                    .toArray()
                    .catch(() => []);
                logger.log(`📤 [SYNC] Pushing ${households.length} households for project ${projectId}`);
            }
            
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

            // 2. PULL server changes with pagination to avoid memory overload
            const response = await apiClient.get('sync/pull', {
                params: { 
                    since: lastSyncRef.current,
                    projectId: projectId || undefined,
                    limit: 1000 // Limit pulled households to 1000 per sync
                }
            });

            const { timestamp, changes } = response.data;

            // Apply changes to local Dexie with memory protection
            if (changes.projects) await syncData('projects', changes.projects);
            
            // Process households in chunks to avoid memory spikes
            if (changes.households && changes.households.length > 0) {
                logger.log(`📥 [SYNC] Pulling ${changes.households.length} household changes`);
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

            lastSyncRef.current = timestamp;
            setLastSyncState(timestamp);
            setSyncStatus('success');
            safeStorage.setItem('last_sync_timestamp', timestamp);

            // Optimize memory after sync
            await optimizeMemory(projectId);

            // LOG successful sync for the banner
            await db.sync_logs.add({
                timestamp: new Date(),
                action: `Synchronisation réussie (${changes.households?.length || 0} ménages)`,
                details: { timestamp, changes: Object.keys(changes) }
            });

            // Retour au statut idle après 3s pour l'UI
            setTimeout(() => setSyncStatus('idle'), 3000);

            return { success: true };
        } catch (error) {
            logger.error('Sync failed:', error);
            setSyncStatus('error');
            if (!isAuto) throw error;
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, []); // Stable identity

    // Live Sync: Background sync every 5 minutes if browser is active
    useEffect(() => {
        const interval = setInterval(() => {
            if (navigator.onLine) {
                sync(undefined, true);
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [sync]);

    return {
        sync,
        isSyncing,
        lastSync,
        syncStatus
    };
}

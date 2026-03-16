import { useLiveQuery } from 'dexie-react-hooks';
import { db, syncData } from '../store/db';
import apiClient from '../api/client';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import { useAuth } from '../contexts/AuthContext';

// Module-level guard to prevent concurrent syncs across the whole application
let isSyncRunning = false;

export function useOfflineSync() {
    const { user } = useAuth();
    
    // ✅ OPTIMIZATION #1: Monitor only the count, not the full data array.
    const pendingCount = useLiveQuery(
        () => db.syncOutbox.where({ status: 'pending' }).count(),
        [],
        0
    );

    const pullUpdates = async () => {
        const lastSync = safeStorage.getItem('last_sync_timestamp');
        logger.log('📥 [SYNC] Pulling server changes...');
        
        try {
            const response = await apiClient.get('sync/pull', {
                params: {
                    since: lastSync,
                    limit: 1000
                }
            });

            const { timestamp, changes } = response.data;

            // Apply changes in chunks to keep UI responsive
            if (changes.projects) await syncData('projects', changes.projects);
            
            if (changes.households && changes.households.length > 0) {
                logger.log(`📥 [SYNC] Applying ${changes.households.length} household changes...`);
                const CHUNK = 100;
                for (let i = 0; i < changes.households.length; i += CHUNK) {
                    const chunk = changes.households.slice(i, i + CHUNK);
                    await syncData('households', chunk);
                }
            }

            if (changes.zones) await syncData('zones', changes.zones);
            if (changes.teams) await syncData('teams', changes.teams);
            if (changes.inventory) await syncData('inventory', changes.inventory);
            if (changes.expenses) await syncData('expenses', changes.expenses);
            if (changes.missions) await syncData('missions', changes.missions);

            // Update sync timestamp
            safeStorage.setItem('last_sync_timestamp', timestamp);
            
            await db.sync_logs.add({
                timestamp: new Date(),
                action: `Pull réussi (${changes.households?.length || 0} ménages)`,
                details: { timestamp, tables: Object.keys(changes) }
            });

        } catch (error) {
            logger.error('📥 [SYNC] Pull failed:', error);
        }
    };

    const triggerKoboSync = async () => {
        logger.log('🌍 [KOBO] Checking for external submissions...');
        try {
            await apiClient.post('kobo/sync');
        } catch (koboErr) {
            logger.warn('⚠️ [KOBO] Background sync failed:', koboErr);
        }
    };

    const performSync = async () => {
        if (!user || !navigator.onLine || isSyncRunning) return;
        
        isSyncRunning = true;
        
        try {
            const countAtStart = await db.syncOutbox.where({ status: 'pending' }).count();
            
            // 1. PUSH (Batch logic)
            if (countAtStart > 0) {
                logger.log(`📤 [SYNC] Starting specialized batch sync for ${countAtStart} items...`);
                const LIMIT = 50;
                
                while (true) {
                    const items = await db.syncOutbox
                        .where({ status: 'pending' })
                        .limit(LIMIT)
                        .toArray();

                    if (items.length === 0) break;

                    logger.log(`📈 [SYNC] Processing batch of ${items.length} items...`);

                    // Group items by entity type for the /sync/push endpoint
                    const batchChanges: any = {};
                    const itemMap: Record<string, any> = {}; // To track item original IDs for deletion

                    for (const item of items) {
                        let entityType = '';
                        if (item.endpoint.includes('households')) entityType = 'households';
                        else if (item.endpoint.includes('projects')) entityType = 'projects';
                        else if (item.endpoint.includes('zones')) entityType = 'zones';
                        else if (item.endpoint.includes('teams')) entityType = 'teams';

                        if (entityType) {
                            if (!batchChanges[entityType]) batchChanges[entityType] = [];
                            
                            // Try to extract ID from endpoint if not in payload
                            const endpointSegments = item.endpoint.split('/');
                            const idFromEndpoint = endpointSegments[endpointSegments.length - 1];
                            const payload = { ...item.payload };
                            
                            if (idFromEndpoint && idFromEndpoint !== entityType && !payload.id) {
                                payload.id = idFromEndpoint;
                            }

                            batchChanges[entityType].push(payload);
                            itemMap[`${entityType}:${payload.id}`] = item.id;
                        }
                    }

                    try {
                        const response = await apiClient.post('sync/push', { changes: batchChanges });
                        const { results } = response.data;

                        // ✅ Delete successfully synced items
                        if (results?.success?.length > 0) {
                            const idsToDelete = results.success
                                .map((s: any) => itemMap[`${s.type}s:${s.id}`] || itemMap[`${s.type}:${s.id}`])
                                .filter(Boolean);
                            
                            if (idsToDelete.length > 0) {
                                await db.syncOutbox.bulkDelete(idsToDelete);
                                logger.log(`🗑️ [SYNC] Deleted ${idsToDelete.length} synced items from outbox`);
                            }
                        }

                        // Handle conflicts or errors if needed (non-fatal)
                        if (results?.errors?.length > 0) {
                            logger.warn(`⚠️ [SYNC] ${results.errors.length} items had errors during batch`);
                        }

                    } catch (error: any) {
                        logger.error('❌ [SYNC] Batch push failed:', error);
                        // If it's a transient error, stop the loop and retry later
                        if (!error.response || error.response.status >= 500 || error.response.status === 429) {
                            throw error;
                        }
                        break; // Fatal error for this batch, stop loop
                    }

                    if (items.length < LIMIT) break;
                    
                    // ✅ Sleep 300ms to avoid overwhelming the server (Audit recommendation)
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // 2. PULL
            await pullUpdates();

            // 3. KOBO
            await triggerKoboSync();

        } catch (globalError) {
            logger.error('🔥 [SYNC] Critical failure in unified loop', globalError);
        } finally {
            isSyncRunning = false;
            logger.log('✅ [SYNC] Cycle sync complet terminé');
        }
    };

    return {
        pendingCount,
        syncData: performSync
    };
}



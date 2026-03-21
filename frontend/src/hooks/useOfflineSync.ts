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
                
                // [DEBUG] Check for :1 suffix in IDs
                const suffixedIds = changes.households
                    .filter((h: any) => h.id.toString().includes(':'))
                    .map((h: any) => h.id);
                if (suffixedIds.length > 0) {
                    logger.warn('⚠️ [SYNC] Found household IDs with suffixes in pull response:', suffixedIds);
                }

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

                    // Group items by entity type for the /sync/push endpoint
                    const batchChanges: Record<string, any[]> = {};
                    const itemMap = new Map<string, number[]>(); // Map entity_key -> outbox_ids[]

                    for (const item of items) {
                        let entityType = '';
                        if (item.endpoint.includes('households')) entityType = 'households';
                        else if (item.endpoint.includes('projects')) entityType = 'projects';
                        else if (item.endpoint.includes('zones')) entityType = 'zones';
                        else if (item.endpoint.includes('teams')) entityType = 'teams';

                        if (entityType) {
                            if (!batchChanges[entityType]) batchChanges[entityType] = [];
                            
                            const payload = item.payload;
                            let id = payload.id;
                            
                            if (!id) {
                                const segments = item.endpoint.split('/');
                                id = segments[segments.length - 1];
                                if (id && id !== entityType) {
                                    payload.id = id;
                                }
                            }

                            if (id) {
                                batchChanges[entityType].push(payload);
                                
                                // Store the mapping to delete from outbox later (supports duplicates)
                                const key = `${entityType}:${id}`;
                                const existing = itemMap.get(key) || [];
                                itemMap.set(key, [...existing, item.id as number]);
                            }
                        }
                    }

                    if (Object.keys(batchChanges).length === 0) {
                        // If no valid entities found, mark items as 'failed' to prevent infinite loop
                        const itemIds = items.map(i => i.id as number);
                        await db.syncOutbox.bulkUpdate(itemIds.map(id => ({ key: id, changes: { status: 'failed' } })));
                        break;
                    }

                    try {
                        const response = await apiClient.post('sync/push', { changes: batchChanges });
                        const { results } = response.data;

                        // ✅ Delete successfully synced items
                        const idsToDelete: number[] = [];
                        let successCount = 0;
                        if (results?.success?.length > 0) {
                            for (const s of results.success) {
                                const type = s.type.endsWith('s') ? s.type : `${s.type}s`;
                                const key = `${type}:${s.id}`;
                                const outboxIds = itemMap.get(key);
                                if (outboxIds && outboxIds.length > 0) {
                                    const outboxId = outboxIds.shift();
                                    if (outboxId) {
                                        idsToDelete.push(outboxId);
                                        successCount++;
                                    }
                                }
                            }
                        }

                        if (idsToDelete.length > 0) {
                            await db.syncOutbox.bulkDelete(idsToDelete);
                        }

                        logger.log(`📤 [SYNC] Batch progress: ${successCount}/${items.length} items synced successfully`);

                        if (results?.errors?.length > 0) {
                            logger.warn(`⚠️ [SYNC] ${results.errors.length} items had errors during batch`);
                            // Mark failed items to avoid infinite loop
                            for (const e of results.errors) {
                                const type = e.type.endsWith('s') ? e.type : `${e.type}s`;
                                const key = `${type}:${e.id}`;
                                const outboxIds = itemMap.get(key);
                                if (outboxIds && outboxIds.length > 0) {
                                    const outboxId = outboxIds.shift();
                                    if (outboxId) {
                                        await db.syncOutbox.update(outboxId, { status: 'failed', lastError: e.error });
                                    }
                                }
                            }
                        }

                    } catch (error: any) {
                        logger.error('❌ [SYNC] Batch push failed:', error);
                        if (!error.response || error.response.status >= 500 || error.response.status === 429) {
                            throw error;
                        }
                        // For 400 errors, mark current batch as failed to allow progress
                        const itemIds = items.map(i => i.id as number);
                        await db.syncOutbox.bulkUpdate(itemIds.map(id => ({ key: id, changes: { status: 'failed' } })));
                        break; 
                    }

                    if (items.length < LIMIT) break;
                    await new Promise(r => setTimeout(r, 200)); // Slight delay
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



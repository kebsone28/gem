/**
 * Conflict Resolver Service
 * Handles data conflicts between local and server versions.
 * Strategies: 'server-wins' | 'client-wins' | 'merge'
 * Pure module — no React.
 */

import { logger } from '../logger';
import { db } from '../../store/db';
import { useSyncStore } from '../../store/syncStore';

export type ConflictStrategy = 'server-wins' | 'client-wins' | 'merge';

export interface ConflictRecord {
    id: string;
    entityType: string;
    entityId: string;
    localData: unknown;
    serverData: unknown;
    resolvedData?: unknown;
    strategy: ConflictStrategy;
    resolvedAt: string;
}

/** Default strategy per entity type */
const DEFAULT_STRATEGIES: Record<string, ConflictStrategy> = {
    households: 'server-wins', // Server is source of truth for household status
    projects:   'server-wins',
    zones:      'server-wins',
    teams:      'server-wins',
};

/**
 * Resolve a single conflict.
 * Returns the data that should be persisted locally.
 */
export function resolveConflict(
    entityType: string,
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    strategy?: ConflictStrategy,
): unknown {
    const resolvedStrategy = strategy ?? DEFAULT_STRATEGIES[entityType] ?? 'server-wins';

    switch (resolvedStrategy) {
        case 'server-wins':
            return serverData;

        case 'client-wins':
            return localData;

        case 'merge': {
            // Simple field-level merge: prefer server for system fields, client for user fields
            const systemFields = ['id', 'organizationId', 'projectId', 'version', 'deletedAt', 'updatedAt'];
            const merged: Record<string, unknown> = { ...localData };

            for (const key of systemFields) {
                if (serverData[key] !== undefined) {
                    merged[key] = serverData[key];
                }
            }

            // Take the higher version
            const localVersion = (localData['version'] as number) ?? 0;
            const serverVersion = (serverData['version'] as number) ?? 0;
            merged['version'] = Math.max(localVersion, serverVersion);

            return merged;
        }

        default:
            return serverData;
    }
}

/**
 * Process and log a batch of conflicts returned by the server.
 * Records conflicts in sync_logs and updates syncStore.
 * Actually persists the resolved data back to the local entity table to break the conflict cycle.
 * Returns the list of resolved entity keys (e.g. "households:idXYZ") for outbox cleanup.
 */
export async function handleServerConflicts(
    conflicts: Array<{ 
        type?: string; 
        id?: string; 
        entityType?: string; 
        entityId?: string; 
        serverData: Record<string, unknown>; 
        localData?: Record<string, unknown> 
    }>
): Promise<string[]> {
    if (conflicts.length === 0) return [];

    const resolvedKeys: string[] = [];

    const records: ConflictRecord[] = conflicts.map(c => {
        // Handle varying server response formats (type vs entityType, id vs entityId)
        let type = c.type ?? c.entityType ?? 'unknown';
        const id = c.id ?? c.entityId ?? (c.serverData?.id as string) ?? 'unknown';

        // Normalize type (pluralize if needed to match Dexie tables, handling exceptions like inventory)
        if (type !== 'unknown' && !type.endsWith('s') && type !== 'inventory') {
            type = `${type}s`;
        }

        const resolvedData = resolveConflict(
            type,
            (c.localData as Record<string, unknown>) ?? {},
            c.serverData,
        );

        const key = `${type}:${id}`;
        resolvedKeys.push(key);

        return {
            id: crypto.randomUUID(),
            entityType: type,
            entityId: id,
            localData: c.localData ?? {},
            serverData: c.serverData,
            resolvedData,
            strategy: DEFAULT_STRATEGIES[type] ?? 'server-wins',
            resolvedAt: new Date().toISOString(),
        };
    });

    // ── PERSIST RESOLUTION TO DEXIE ──────────────────────────────────────
    // This is the critical step to ensure local data is updated with server truth
    for (const record of records) {
        const table = (db as any)[record.entityType];
        if (table && record.resolvedData && record.entityId !== 'unknown') {
            try {
                await table.put(record.resolvedData);
                logger.debug('CONFLICT', `Persisted resolved ${record.entityType}/${record.entityId}`);
            } catch (err) {
                logger.error('CONFLICT', `Failed to persist resolution for ${record.entityType}/${record.entityId}`, err);
            }
        }
    }

    // Log to Dexie logs
    await db.sync_logs.bulkAdd(
        records.map(r => ({
            timestamp: new Date(r.resolvedAt),
            action: `Conflict resolved: ${r.entityType}/${r.entityId} (${r.strategy})`,
            details: r,
        }))
    );

    // Update syncStore conflict count
    useSyncStore.getState().addConflicts(records);

    logger.warn('CONFLICT', `Resolved ${records.length} conflict(s)`, records.map(r => `${r.entityType}/${r.entityId}`));

    return resolvedKeys;
}

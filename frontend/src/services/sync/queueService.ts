/**
 * Queue Service
 * Manages the Dexie syncOutbox: read, write, mark as failed/succeeded.
 * Pure module — no React.
 */

import { db } from '../../store/db';
import type { SyncQueueItem } from '../../store/db';
import { logger } from '../logger';

export type { SyncQueueItem };

const PRIORITY_MAP: Record<string, number> = {
    projects:   1,
    zones:      2,
    teams:      3,
    households: 4,
};

function getEntityType(endpoint: string): string {
    if (endpoint.includes('projects'))   return 'projects';
    if (endpoint.includes('zones'))      return 'zones';
    if (endpoint.includes('teams'))      return 'teams';
    if (endpoint.includes('households')) return 'households';
    return 'unknown';
}

/** Fetch a sorted, prioritised batch of pending items */
export async function fetchPendingBatch(limit = 50): Promise<SyncQueueItem[]> {
    const raw = await db.syncOutbox
        .where({ status: 'pending' })
        .limit(limit * 2)
        .toArray();

    return raw
        .sort((a, b) => {
            const pa = PRIORITY_MAP[getEntityType(a.endpoint)] ?? 99;
            const pb = PRIORITY_MAP[getEntityType(b.endpoint)] ?? 99;
            return pa - pb;
        })
        .slice(0, limit);
}

/** Count pending items (lightweight observable) */
export async function countPending(): Promise<number> {
    return db.syncOutbox.where({ status: 'pending' }).count();
}

/** Enqueue a new sync operation */
export async function enqueue(item: Omit<SyncQueueItem, 'id' | 'retryCount' | 'status' | 'timestamp'>): Promise<number> {
    return db.syncOutbox.add({
        ...item,
        status: 'pending',
        retryCount: 0,
        timestamp: Date.now(),
    });
}

/** Mark items as synced (delete them from outbox) */
export async function markSynced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.syncOutbox.bulkDelete(ids);
    logger.debug('QUEUE', `Removed ${ids.length} synced items from outbox`);
}

/** Mark items as failed */
export async function markFailed(ids: number[], error?: string): Promise<void> {
    if (ids.length === 0) return;
    await db.syncOutbox.bulkUpdate(
        ids.map(id => ({ key: id, changes: { status: 'failed' as const, lastError: error } }))
    );
    logger.warn('QUEUE', `Marked ${ids.length} items as failed`, error);
}

/** Increment retry counter for an item */
export async function incrementRetry(id: number): Promise<void> {
    const item = await db.syncOutbox.get(id);
    if (!item) return;
    await db.syncOutbox.update(id, { retryCount: (item.retryCount ?? 0) + 1, status: 'pending' });
}

/** Purge all failed items */
export async function purgeFailed(): Promise<number> {
    const failed = await db.syncOutbox.where({ status: 'failed' }).toArray();
    await db.syncOutbox.bulkDelete(failed.map(f => f.id as number));
    logger.info('QUEUE', `Purged ${failed.length} failed items`);
    return failed.length;
}

export { getEntityType };

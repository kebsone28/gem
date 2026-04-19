/**
 * Conflict Resolver Service
 * Handles data conflicts between local and server versions.
 * Strategies: 'server-wins' | 'client-wins' | 'merge'
 * Pure module — no React.
 */

import { logger } from '../logger';
import { db } from '../../store/db';
import { useSyncStore } from '../../store/syncStore';
import { enqueue } from './queueService';
import { canTransition } from '../../domain/status/statusUtils';

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
  households: 'merge', // Remplacé: On merge les données au lieu de supprimer l'input offline
  projects: 'server-wins',
  zones: 'server-wins',
  teams: 'server-wins',
};

/**
 * Resolve a single conflict.
 * Returns the data that should be persisted locally.
 */
export function resolveConflict(
  entityType: string,
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  strategy?: ConflictStrategy
): unknown {
  const resolvedStrategy = strategy ?? DEFAULT_STRATEGIES[entityType] ?? 'server-wins';

  switch (resolvedStrategy) {
    case 'server-wins':
      return serverData;

    case 'client-wins':
      return localData;

    case 'merge': {
      // Base on server data (Kobo truth + system fields)
      const merged: Record<string, unknown> = { ...serverData };

      // Intelligent Merge for Households
      if (entityType === 'households') {
        const localStatus = (localData['status'] as string) || '';
        const serverStatus = (serverData['status'] as string) || '';

        // Prioritize advanced statuses locally so we don't regress work
        // Utilisation stricte de notre engine de règles
        if (localStatus && canTransition(serverStatus, localStatus)) {
            merged['status'] = localStatus;
        }

        // --- RÈGLE MÉTIER STRICTE ---
        // Le Reste (Nom, Tél, GPS, Équipes, etc.) obéit toujours à Kobo/Serveur 
        // L'unique exception locale est le statut forcé par l'admin ci-dessus.
      }

      // System fields MUST be server truth
      const systemFields = [
        'id',
        'organizationId',
        'projectId',
        'zoneId',
        'deletedAt'
      ];

      for (const key of systemFields) {
        // Handle nested projectId from serverData if zone is populated
        if (key === 'projectId' && serverData.zone && (serverData.zone as any).projectId) {
          merged[key] = (serverData.zone as any).projectId;
        } else if (serverData[key] !== undefined) {
          merged[key] = serverData[key];
        } else if (localData[key] !== undefined) {
          merged[key] = localData[key];
        }
      }

      // VITAL: Take the higher version AND INCREMENT IT locally
      // so the next sync forces the server to accept our merged resolution
      const localVersion = (localData['version'] as number) ?? 0;
      const serverVersion = (serverData['version'] as number) ?? 0;
      merged['version'] = Math.max(localVersion, serverVersion) + 1;

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
    localData?: Record<string, unknown>;
  }>
): Promise<string[]> {
  if (conflicts.length === 0) return [];

  const resolvedKeys: string[] = [];

  const records: ConflictRecord[] = conflicts.map((c) => {
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
      c.serverData
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

        // Si on a fusionné des données locales avec le serveur, il faut que 
        // le serveur prenne connaissance de cette fusion au prochain cycle.
        if (record.strategy === 'merge') {
            await enqueue({
                action: 'UPDATE', 
                endpoint: `/api/${record.entityType}`,
                method: 'POST', // Missing method added
                payload: record.resolvedData
            });
            logger.debug('CONFLICT', `Re-enqueued post-merge ${record.entityType}/${record.entityId}`);
        }
      } catch (err) {
        logger.error(
          'CONFLICT',
          `Failed to persist resolution for ${record.entityType}/${record.entityId}`,
          err
        );
      }
    }
  }

  // Log to Dexie logs
  await db.sync_logs.bulkAdd(
    records.map((r) => ({
      timestamp: new Date(r.resolvedAt),
      action: `Conflict resolved: ${r.entityType}/${r.entityId} (${r.strategy})`,
      details: r,
    }))
  );

  // Update syncStore conflict count
  useSyncStore.getState().addConflicts(records);

  logger.warn(
    'CONFLICT',
    `Resolved ${records.length} conflict(s)`,
    records.map((r) => `${r.entityType}/${r.entityId}`)
  );

  return resolvedKeys;
}

/**
 * Core synchronization logic v2
 * - Compression (gzip via pako si disponible, fallback JSON minifié)
 * - Résolution de conflits (timestamp-based)
 * - Envoi par lots (batch)
 * - Catégorisation des erreurs (network vs server vs conflict)
 * - Backoff exponentiel amélioré
 */
import { submitFormData, submitBatchSubmissions, getServerSubmission } from './api';
import { getPendingSubmissions, updateSubmission, loadSubmissions } from './storage';
import { logger } from '@utils/logger';

const MAX_RETRY_COUNT = 5;
const INITIAL_BACKOFF = 10000;
const MAX_BACKOFF = 300000; // 5 min
const BATCH_SIZE = 10;

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

type ErrorCategory = 'network' | 'server' | 'conflict' | 'validation' | 'unknown';

let isSyncing = false;
let currentBackoff = INITIAL_BACKOFF;

// Try to load pako for gzip compression
let pako: any = null;
try { pako = require('pako'); } catch {}

// Custom btoa implementation for React Native environment
function btoa(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
       input.charAt(i | 0) || (map = '=', i % 1);
       output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = input.charCodeAt(i += 3 / 4);
    if (charCode > 0xFF) {
      throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    }
    block = block << 8 | charCode;
  }
  return output;
}

/**
 * Compress payload with gzip if available, otherwise minify JSON
 */
function compressPayload(data: any): string | Uint8Array {
  const json = JSON.stringify(data);
  if (pako) {
    const compressed = pako.gzip(json);
    // Convert to base64 for transport
    const binary = String.fromCharCode(...new Uint8Array(compressed));
    return btoa(binary);
  }
  // Fallback: minified JSON (remove all whitespace)
  return json;
}

/**
 * Categorize error for better handling
 */
function categorizeError(error: any): ErrorCategory {
  const msg = String(error?.message || error || '').toLowerCase();
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout') ||
      msg.includes('enotfound') || msg.includes('fetch')) return 'network';
  if (msg.includes('409') || msg.includes('conflict') || msg.includes('version')) return 'conflict';
  if (msg.includes('422') || msg.includes('validation') || msg.includes('invalid')) return 'validation';
  if (msg.includes('500') || msg.includes('503') || msg.includes('server error')) return 'server';
  return 'unknown';
}

/**
 * Detect conflict by comparing local savedAt with server version
 */
async function detectConflict(submission: any): Promise<boolean> {
  try {
    const serverSub = await getServerSubmission(submission.clientSubmissionId || submission.id);
    if (!serverSub) return false;
    const serverUpdated = new Date(serverSub.updatedAt || 0).getTime();
    const localUpdated = new Date(submission.updatedAt || submission.createdAt || 0).getTime();
    // If server has newer version and local hasn't been modified recently, it's a conflict
    if (serverUpdated > localUpdated + 5000) return true;
  } catch {
    // If we can't check, assume no conflict and try to sync
  }
  return false;
}

/**
 * Core sync function v2 with compression, batching, and conflict resolution
 */
export async function performCoreSync(): Promise<SyncResult> {
  if (isSyncing) {
    return { synced: 0, failed: 0, conflicts: 0, errors: ['Sync already in progress'] };
  }
  isSyncing = true;

  const errors: string[] = [];
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  try {
    const pending = await getPendingSubmissions();
    logger.info(`[SyncCore] ${pending.length} submission(s) pending`);

    if (pending.length === 0) {
      return { synced: 0, failed: 0, conflicts: 0, errors: [] };
    }

    // Attempt batch sync first (if API supports it)
    if (pending.length > 1) {
      try {
        const batch = pending.slice(0, BATCH_SIZE).map((sub) => ({
          id: sub.id,
          formKey: sub.formKey,
          formVersion: sub.formVersion || '1.0',
          clientSubmissionId: sub.clientSubmissionId || sub.id,
          status: 'submitted',
          values: sub.values as Record<string, any>,
          metadata: { ...sub.metadata, submittedAt: new Date().toISOString() },
          photos: sub.photos as Record<string, string[]> | undefined,
        }));

        const compressed = compressPayload(batch);
        // Mark all as syncing
        for (const item of batch) {
          await updateSubmission(item.id, { status: 'syncing' });
        }

        const batchResult = await submitBatchSubmissions({ submissions: batch, compressed });
        if (batchResult.success) {
          for (const item of batch) {
            await updateSubmission(item.id, {
              status: 'synced',
              retryCount: 0,
              errorMessage: undefined,
            });
          }
          synced += batch.length;
          // Remove synced items from pending list for individual processing
          const batchIds = new Set(batch.map((b) => b.id));
          const remaining = pending.filter((p) => !batchIds.has(p.id));

          // Process remaining individually
          for (const sub of remaining) {
            await syncSingleSubmission(sub);
            synced++;
          }
        } else {
          // Batch failed, fall through to individual
          for (const item of batch) {
            await updateSubmission(item.id, { status: 'pending' });
          }
          await syncRemainingIndividually(pending, errors, failed, conflicts, synced);
        }
      } catch {
        // Batch failed, fall through to individual
        await syncRemainingIndividually(pending, errors, failed, conflicts, synced);
      }
    } else {
      // Single submission
      for (const sub of pending) {
        const result = await syncSingleSubmission(sub);
        if (result === 'synced') synced++;
        else if (result === 'conflict') conflicts++;
        else {
          failed++;
          errors.push(`[${sub.formKey}] Sync failed`);
        }
      }
    }
  } catch (e: any) {
    logger.error('[SyncCore] Sync failed', e.message);
    errors.push(e.message);
  } finally {
    isSyncing = false;
  }

  // Update backoff based on results
  if (failed > 0 && synced === 0) {
    currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
  } else {
    currentBackoff = INITIAL_BACKOFF;
  }

  return { synced, failed, conflicts, errors };
}

async function syncRemainingIndividually(
  pending: any[],
  errors: string[],
  failed: number,
  conflicts: number,
  synced: number,
) {
  for (const sub of pending) {
    const result = await syncSingleSubmission(sub);
    if (result === 'synced') synced++;
    else if (result === 'conflict') conflicts++;
    else {
      failed++;
      errors.push(`[${sub.formKey}] Sync failed`);
    }
  }
}

/**
 * Sync a single submission with conflict detection and retry tracking
 */
async function syncSingleSubmission(sub: any): Promise<'synced' | 'conflict' | 'failed'> {
  try {
    // Check for conflicts
    const hasConflict = await detectConflict(sub);
    if (hasConflict) {
      await updateSubmission(sub.id, {
        status: 'synced', // Mark as synced (server version wins)
        errorMessage: 'Conflit detecte: version serveur conservee',
        retryCount: sub.retryCount || 0,
      });
      logger.warn(`[SyncCore] Conflict resolved for ${sub.id}, server version kept`);
      return 'conflict';
    }

    await updateSubmission(sub.id, { status: 'syncing' });

    const payload = {
      formKey: sub.formKey,
      formVersion: sub.formVersion || '1.0',
      clientSubmissionId: sub.clientSubmissionId || sub.id,
      status: 'submitted',
      values: sub.values as Record<string, any>,
      metadata: { ...sub.metadata, submittedAt: new Date().toISOString() },
      photos: sub.photos as Record<string, string[]> | undefined,
    };

    // Compress payload for large submissions
    const compressed = JSON.stringify(payload).length > 10240
      ? compressPayload(payload)
      : null;

    const result = compressed
      ? await submitFormData({ ...payload, compressed } as any)
      : await submitFormData(payload);

    // Success
    await updateSubmission(sub.id, {
      status: 'synced',
      retryCount: 0,
      errorMessage: undefined,
    });
    logger.info(`[SyncCore] Synced ${sub.id}`);
    return 'synced';
  } catch (e: any) {
    const category = categorizeError(e);
    const currentRetryCount = (sub.retryCount || 0) + 1;
    const msg = `[${sub.formKey}] ${e.message}`;
    logger.error(`[SyncCore] Failed (${category}) ${sub.id}:`, e.message);

    if (category === 'conflict') {
      await updateSubmission(sub.id, {
        status: 'synced',
        errorMessage: 'Conflit: version serveur conservee',
        retryCount: currentRetryCount,
      });
      return 'conflict';
    }

    if (currentRetryCount >= MAX_RETRY_COUNT || category === 'validation') {
      await updateSubmission(sub.id, {
        status: 'error',
        errorMessage: `[${category}] ${msg}`,
        retryCount: currentRetryCount,
      });
    } else {
      await updateSubmission(sub.id, {
        status: 'pending',
        errorMessage: `[${category}] ${msg}`,
        retryCount: currentRetryCount,
      });
    }

    return 'failed';
  }
}

export function getCurrentBackoff(): number {
  return currentBackoff;
}

export function resetBackoff(): void {
  currentBackoff = INITIAL_BACKOFF;
}

export function isSyncActive(): boolean {
  return isSyncing;
}

export function getMaxRetryCount(): number {
  return MAX_RETRY_COUNT;
}

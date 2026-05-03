import apiClient from '../api/client';
import { db, type SyncQueueItem } from '../store/db';

export type InternalKoboSubmissionStatus = 'draft' | 'submitted' | 'validated' | 'rejected';

export interface InternalKoboSubmissionPayload {
  clientSubmissionId: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey: string;
  formVersion: string;
  role?: string | null;
  status: InternalKoboSubmissionStatus;
  values: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requiredMissing: string[];
  householdPatch?: Record<string, unknown>;
}

export interface InternalKoboSubmissionResponse {
  success: boolean;
  submission?: Record<string, unknown>;
  household?: Record<string, unknown> | null;
  message?: string;
}

export interface InternalKoboSubmissionRecord {
  id: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey: string;
  formVersion: string;
  clientSubmissionId: string;
  role?: string | null;
  status: InternalKoboSubmissionStatus;
  syncStatus: string;
  values: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requiredMissing: string[];
  submittedAt?: string | null;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
  household?: {
    id?: string;
    numeroordre?: string | null;
    name?: string | null;
    phone?: string | null;
    status?: string | null;
    region?: string | null;
    village?: string | null;
    updatedAt?: string | null;
  } | null;
  submittedBy?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

const INTERNAL_KOBO_OUTBOX_ACTION = 'internal-kobo-submit';
const INTERNAL_KOBO_SUBMISSION_ENDPOINT = '/internal-kobo/submissions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Erreur reseau inconnue';
}

function isInternalKoboQueueItem(item: SyncQueueItem): item is SyncQueueItem & {
  payload: InternalKoboSubmissionPayload;
} {
  const payload = item.payload as Partial<InternalKoboSubmissionPayload>;
  return item.action === INTERNAL_KOBO_OUTBOX_ACTION && Boolean(payload?.clientSubmissionId);
}

export async function submitInternalKoboSubmission(
  payload: InternalKoboSubmissionPayload
): Promise<InternalKoboSubmissionResponse> {
  const response = await apiClient.post<InternalKoboSubmissionResponse>(
    INTERNAL_KOBO_SUBMISSION_ENDPOINT,
    payload
  );
  return response.data;
}

export async function fetchInternalKoboSubmissions(params: {
  householdId?: string;
  numeroOrdre?: string;
  status?: InternalKoboSubmissionStatus;
  formKey?: string;
  limit?: number;
} = {}): Promise<InternalKoboSubmissionRecord[]> {
  const response = await apiClient.get<{
    success: boolean;
    submissions?: InternalKoboSubmissionRecord[];
  }>(INTERNAL_KOBO_SUBMISSION_ENDPOINT, { params });

  return response.data.submissions || [];
}

export async function queueInternalKoboSubmission(
  payload: InternalKoboSubmissionPayload,
  reason?: string
): Promise<number | undefined> {
  const timestamp = Date.now();
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const existing = queuedItems.find(
    (item) =>
      isInternalKoboQueueItem(item) &&
      item.payload.clientSubmissionId === payload.clientSubmissionId
  );

  if (existing?.id) {
    await db.syncOutbox.update(existing.id, {
      payload: payload as unknown as Record<string, unknown>,
      timestamp,
      status: 'pending',
      lastError: reason,
    });
    return existing.id;
  }

  return db.syncOutbox.add({
    action: INTERNAL_KOBO_OUTBOX_ACTION,
    endpoint: INTERNAL_KOBO_SUBMISSION_ENDPOINT,
    method: 'POST',
    payload: payload as unknown as Record<string, unknown>,
    timestamp,
    status: 'pending',
    retryCount: 0,
    lastError: reason,
  });
}

export async function flushInternalKoboSubmissionQueue(): Promise<{
  flushed: number;
  failed: number;
  pending: number;
}> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const internalItems = queuedItems
    .filter(isInternalKoboQueueItem)
    .sort((a, b) => a.timestamp - b.timestamp);

  let flushed = 0;
  let failed = 0;

  for (const item of internalItems) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break;

    try {
      await apiClient.request({
        url: item.endpoint,
        method: item.method,
        data: item.payload,
      });

      if (item.id) {
        await db.syncOutbox.delete(item.id);
      }
      flushed += 1;
    } catch (error) {
      failed += 1;
      if (item.id) {
        await db.syncOutbox.update(item.id, {
          status: 'failed',
          retryCount: (item.retryCount || 0) + 1,
          lastError: getErrorMessage(error),
          timestamp: Date.now(),
        });
      }
    }
  }

  const remaining = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const pending = remaining.filter(isInternalKoboQueueItem).length;

  return { flushed, failed, pending };
}

export async function getInternalKoboQueueCount(): Promise<number> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  return queuedItems.filter(isInternalKoboQueueItem).length;
}

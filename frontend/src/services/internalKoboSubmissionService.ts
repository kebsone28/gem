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

export interface InternalKoboFormDefinitionInfo {
  formKey: string;
  formVersion: string;
  engine: string;
  allowedRoles: string[];
  serverValidation: boolean;
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

export interface InternalKoboSubmissionDiagnostics {
  scope?: string;
  health?: 'ok' | 'warning' | 'critical' | string;
  total?: number;
  count?: number;
  receivedLast24h?: number;
  sampleSize?: number;
  byStatus?: Record<string, number>;
  byRole?: Record<string, number>;
  bySyncStatus?: Record<string, number>;
  versionMismatchCount?: number;
  missingRequiredCount?: number;
  unresolvedHouseholdCount?: number;
  latestSavedAt?: string | null;
  serverFormVersion?: string;
  warnings?: string[];
  generatedAt?: string;
}

export interface InternalKoboSubmissionFilters {
  householdId?: string;
  numeroOrdre?: string;
  status?: InternalKoboSubmissionStatus;
  syncStatus?: string;
  role?: string;
  formKey?: string;
  clientSubmissionId?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface InternalKoboSubmissionsReport {
  submissions: InternalKoboSubmissionRecord[];
  diagnostics: InternalKoboSubmissionDiagnostics | null;
  count: number;
}

export interface InternalKoboQueuedSubmission {
  id?: number;
  clientSubmissionId: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  role?: string | null;
  status: 'pending' | 'failed';
  submissionStatus: InternalKoboSubmissionStatus;
  formVersion: string;
  retryCount: number;
  lastError?: string;
  timestamp: number;
}

export interface InternalKoboLocalDraft {
  key: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  role?: string | null;
  formVersion: string;
  values: Record<string, unknown>;
  updatedAt: string;
}

const INTERNAL_KOBO_OUTBOX_ACTION = 'internal-kobo-submit';
const INTERNAL_KOBO_SUBMISSION_ENDPOINT = '/internal-kobo/submissions';
const INTERNAL_KOBO_FORM_DEFINITION_ENDPOINT = '/internal-kobo/form-definition';
const INTERNAL_KOBO_DIAGNOSTICS_ENDPOINT = '/internal-kobo/diagnostics';
const INTERNAL_KOBO_DRAFT_PREFIX = 'gem-internal-kobo-draft:';
const MAX_INTERNAL_KOBO_RETRIES = 6;

export function getInternalKoboErrorStatus(error: unknown): number | null {
  const status = (error as any)?.response?.status;
  return typeof status === 'number' ? status : null;
}

export function isRetriableInternalKoboError(error: unknown): boolean {
  const status = getInternalKoboErrorStatus(error);
  if (!status) return true;
  return status === 408 || status === 429 || status >= 500;
}

export function getInternalKoboErrorMessage(error: unknown): string {
  const responseMessage = (error as any)?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
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

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getInternalKoboDraftKeys(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
}): string[] {
  const keys: string[] = [];
  const householdId = String(params.householdId || '').trim();
  const numeroOrdre = String(params.numeroOrdre || '').trim();

  if (householdId) keys.push(`${INTERNAL_KOBO_DRAFT_PREFIX}household:${householdId}`);
  if (numeroOrdre) keys.push(`${INTERNAL_KOBO_DRAFT_PREFIX}numero:${numeroOrdre}`);

  return keys;
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

export async function fetchInternalKoboFormDefinition(): Promise<InternalKoboFormDefinitionInfo | null> {
  const response = await apiClient.get<{
    success: boolean;
    form?: InternalKoboFormDefinitionInfo;
  }>(INTERNAL_KOBO_FORM_DEFINITION_ENDPOINT);

  return response.data.form || null;
}

export async function fetchInternalKoboSubmissionsReport(
  params: InternalKoboSubmissionFilters = {}
): Promise<InternalKoboSubmissionsReport> {
  const response = await apiClient.get<{
    success: boolean;
    count?: number;
    submissions?: InternalKoboSubmissionRecord[];
    diagnostics?: InternalKoboSubmissionDiagnostics;
  }>(INTERNAL_KOBO_SUBMISSION_ENDPOINT, { params });

  return {
    submissions: response.data.submissions || [],
    diagnostics: response.data.diagnostics || null,
    count: response.data.count ?? response.data.submissions?.length ?? 0,
  };
}

export async function fetchInternalKoboSubmissions(
  params: InternalKoboSubmissionFilters = {}
): Promise<InternalKoboSubmissionRecord[]> {
  const report = await fetchInternalKoboSubmissionsReport(params);
  return report.submissions;
}

export async function fetchInternalKoboDiagnostics(): Promise<InternalKoboSubmissionDiagnostics | null> {
  const response = await apiClient.get<{
    success: boolean;
    diagnostics?: InternalKoboSubmissionDiagnostics;
  }>(INTERNAL_KOBO_DIAGNOSTICS_ENDPOINT);

  return response.data.diagnostics || null;
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
    .filter((item) => (item.retryCount || 0) < MAX_INTERNAL_KOBO_RETRIES)
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
        const canRetry = isRetriableInternalKoboError(error);
        await db.syncOutbox.update(item.id, {
          status: 'failed',
          retryCount: canRetry ? (item.retryCount || 0) + 1 : MAX_INTERNAL_KOBO_RETRIES,
          lastError: canRetry
            ? getInternalKoboErrorMessage(error)
            : `Validation serveur: ${getInternalKoboErrorMessage(error)}`,
          timestamp: Date.now(),
        });
      }
    }
  }

  const remaining = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const pending = remaining.filter(isInternalKoboQueueItem).length;

  return { flushed, failed, pending };
}

export async function getInternalKoboQueueItems(): Promise<InternalKoboQueuedSubmission[]> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();

  return queuedItems
    .filter(isInternalKoboQueueItem)
    .map((item) => ({
      id: item.id,
      clientSubmissionId: item.payload.clientSubmissionId,
      householdId: item.payload.householdId,
      numeroOrdre: item.payload.numeroOrdre,
      role: item.payload.role,
      status: item.status,
      submissionStatus: item.payload.status,
      formVersion: item.payload.formVersion,
      retryCount: item.retryCount || 0,
      lastError: item.lastError,
      timestamp: item.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getInternalKoboQueueCount(): Promise<number> {
  return getInternalKoboQueueItems().then((items) => items.length);
}

export function saveInternalKoboLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  role?: string | null;
  formVersion: string;
  values: Record<string, unknown>;
}): InternalKoboLocalDraft | null {
  if (!canUseLocalStorage()) return null;

  const [key] = getInternalKoboDraftKeys(params);
  if (!key) return null;

  const draft: InternalKoboLocalDraft = {
    key,
    householdId: params.householdId,
    numeroOrdre: params.numeroOrdre,
    role: params.role,
    formVersion: params.formVersion,
    values: params.values,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export function loadInternalKoboLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
}): InternalKoboLocalDraft | null {
  if (!canUseLocalStorage()) return null;

  for (const key of getInternalKoboDraftKeys(params)) {
    const rawDraft = window.localStorage.getItem(key);
    if (!rawDraft) continue;

    try {
      const draft = JSON.parse(rawDraft) as InternalKoboLocalDraft;
      if (draft?.values && typeof draft.values === 'object') {
        return { ...draft, key };
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return null;
}

export function clearInternalKoboLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
}): void {
  if (!canUseLocalStorage()) return;

  getInternalKoboDraftKeys(params).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

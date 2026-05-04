import apiClient from '../api/client';
import { db, type SyncQueueItem } from '../store/db';

export type InternalKoboSubmissionStatus = 'draft' | 'submitted' | 'validated' | 'rejected';

export interface InternalKoboAttachment {
  id?: string;
  fieldName: string;
  fieldCode?: string;
  valuePath?: Array<string | number>;
  fileName?: string;
  mimeType?: string;
  originalBytes?: number;
  storedBytes?: number;
  sha256?: string;
  capturedAt?: string;
  source?: string;
  status?: string;
  storage?: string;
  url?: string;
  key?: string;
  dataUrl?: string;
}

export interface InternalKoboSubmissionPayload {
  clientSubmissionId: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey: string;
  formVersion: string;
  role?: string | null;
  status: InternalKoboSubmissionStatus;
  values: Record<string, unknown>;
  attachments?: InternalKoboAttachment[];
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

export interface InternalKoboImportedFormSummary {
  id: string;
  formKey: string;
  formVersion: string;
  title?: string;
  engine?: string;
  engineVersion?: string;
  active?: boolean;
  status?: string;
  importedAt?: string | null;
  importedById?: string | null;
  storageKey?: string | null;
  historyCount?: number;
  latestImport?: Record<string, unknown> | null;
  previousDefinitionSummary?: Record<string, unknown> | null;
  previousComparisonSummary?: Record<string, unknown> | null;
  capabilities?: string[];
  diagnostics?: Record<string, unknown>;
  lastValidated?: string;
  updatedAt?: string;
}

export interface InternalKoboFormComparison {
  previous?: Record<string, unknown>;
  current?: Record<string, unknown>;
  summary?: Record<string, number>;
  fields?: Record<string, unknown[]>;
  choices?: Record<string, unknown[]>;
  diagnosticsDelta?: Record<string, unknown>;
}

export interface InternalKoboFormDefinitionInfo {
  formKey: string;
  formVersion: string;
  engine: string;
  allowedRoles: string[];
  serverValidation: boolean;
  universalEngine?: {
    enabled: boolean;
    engine: string;
    engineVersion: string;
    capabilities: string[];
    importedForms: InternalKoboImportedFormSummary[];
  };
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
  attachments?: InternalKoboAttachment[];
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
  byFormKey?: Record<string, number>;
  byFormVersion?: Record<string, number>;
  versionMismatchCount?: number;
  missingRequiredCount?: number;
  validationIssueCount?: number;
  unresolvedHouseholdCount?: number;
  activeFormCount?: number;
  inactiveFormCount?: number;
  activeForms?: InternalKoboImportedFormSummary[];
  inactiveForms?: InternalKoboImportedFormSummary[];
  mediaStats?: {
    attachmentCount?: number;
    serverStoredCount?: number;
    unresolvedCount?: number;
    totalStoredBytes?: number;
    duplicateHashCount?: number;
  };
  clientQueue?: {
    latestReportedAt?: string | null;
    pending?: number;
    failed?: number;
    blocked?: number;
    mediaBytes?: number;
    devices?: Array<Record<string, unknown>>;
  };
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
  submittedById?: string;
  agent?: string;
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
  formKey?: string;
  formVersion: string;
  attachmentCount: number;
  mediaBytes?: number;
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  nextRetryInMs?: number;
  errorType?: string;
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
const INTERNAL_KOBO_FORM_DEFINITIONS_ENDPOINT = '/internal-kobo/form-definitions';
const INTERNAL_KOBO_FORM_CREATE_ENDPOINT = '/internal-kobo/form-definition/create';
const INTERNAL_KOBO_FORM_IMPORT_ENDPOINT = '/internal-kobo/form-definition/import';
const INTERNAL_KOBO_FORM_IMPORT_URL_ENDPOINT = '/internal-kobo/form-definition/import-url';
const INTERNAL_KOBO_DIAGNOSTICS_ENDPOINT = '/internal-kobo/diagnostics';
const INTERNAL_KOBO_CLIENT_QUEUE_ENDPOINT = '/internal-kobo/client-queue-report';
const INTERNAL_KOBO_DRAFT_PREFIX = 'gem-internal-kobo-draft:';
const MAX_INTERNAL_KOBO_RETRIES = 6;
const INTERNAL_KOBO_BASE_RETRY_DELAY_MS = 5000;
const INTERNAL_KOBO_MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

const getFilenameFromDisposition = (disposition?: string, fallback = 'soumissions-kobo-interne.csv') => {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

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

function getInternalKoboErrorType(error: unknown): NonNullable<SyncQueueItem['errorType']> {
  const status = getInternalKoboErrorStatus(error);
  if (!status) return 'network';
  if (status === 409) return 'version';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

function getInternalKoboNextRetryAt(retryCount: number): number {
  const exponentialDelay = Math.min(
    INTERNAL_KOBO_MAX_RETRY_DELAY_MS,
    INTERNAL_KOBO_BASE_RETRY_DELAY_MS * 2 ** Math.max(retryCount, 0)
  );
  const jitter = Math.round(exponentialDelay * (0.15 + Math.random() * 0.25));
  return Date.now() + exponentialDelay + jitter;
}

function getAttachmentBytes(payload: InternalKoboSubmissionPayload): number {
  return (payload.attachments || []).reduce((total, attachment) => total + Number(attachment.storedBytes || attachment.originalBytes || 0), 0);
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

function compactDraftValues(value: unknown, key = ''): unknown {
  if (key.startsWith('_gem_attachment_') && value && typeof value === 'object' && !Array.isArray(value)) {
    const attachment = value as InternalKoboAttachment;
    const compactAttachment = { ...attachment };
    delete compactAttachment.dataUrl;
    return { ...compactAttachment, status: attachment.status || 'queued' };
  }
  if (typeof value === 'string' && value.startsWith('data:')) {
    return '[media conserve dans la file de synchronisation]';
  }
  if (Array.isArray(value)) return value.map((item) => compactDraftValues(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        compactDraftValues(entryValue, entryKey),
      ])
    );
  }
  return value;
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

export async function fetchInternalKoboFormDefinitions(): Promise<NonNullable<InternalKoboFormDefinitionInfo['universalEngine']>['importedForms']> {
  const response = await apiClient.get<{
    success: boolean;
    forms?: NonNullable<InternalKoboFormDefinitionInfo['universalEngine']>['importedForms'];
  }>(INTERNAL_KOBO_FORM_DEFINITIONS_ENDPOINT);

  return response.data.forms || [];
}

export async function fetchInternalKoboImportedFormDefinition(formKey: string): Promise<Record<string, unknown> | null> {
  const response = await apiClient.get<{
    success: boolean;
    form?: Record<string, unknown>;
  }>(`${INTERNAL_KOBO_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}`);

  return response.data.form || null;
}

export async function updateInternalKoboFormDefinitionStatus(
  formKey: string,
  active: boolean
): Promise<InternalKoboImportedFormSummary | null> {
  const response = await apiClient.patch<{
    success: boolean;
    form?: InternalKoboImportedFormSummary;
  }>(`${INTERNAL_KOBO_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}/status`, { active });

  return response.data.form || null;
}

export async function compareInternalKoboFormDefinitions(
  formKey: string,
  targetFormKey: string
): Promise<InternalKoboFormComparison | null> {
  const response = await apiClient.get<{
    success: boolean;
    comparison?: InternalKoboFormComparison;
  }>(
    `${INTERNAL_KOBO_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}/compare/${encodeURIComponent(targetFormKey)}`
  );

  return response.data.comparison || null;
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

export async function reviewInternalKoboSubmission(
  id: string,
  status: Exclude<InternalKoboSubmissionStatus, 'draft'>,
  note = ''
): Promise<InternalKoboSubmissionRecord | null> {
  const response = await apiClient.patch<{
    success: boolean;
    submission?: InternalKoboSubmissionRecord;
  }>(`${INTERNAL_KOBO_SUBMISSION_ENDPOINT}/${id}/review`, { status, note });

  return response.data.submission || null;
}

export async function downloadInternalKoboSubmissionsExport(
  params: InternalKoboSubmissionFilters = {},
  format: 'csv' | 'json' | 'xlsx' = 'csv'
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(`${INTERNAL_KOBO_SUBMISSION_ENDPOINT}/export`, {
    params: { ...params, format },
    responseType: 'blob',
  });
  const extension = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'csv';
  const fallback = `soumissions-kobo-interne-${new Date().toISOString().slice(0, 10)}.${extension}`;

  return {
    blob: response.data,
    filename: getFilenameFromDisposition(response.headers?.['content-disposition'], fallback),
  };
}

export async function importInternalKoboXlsForm(file: File): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: InternalKoboFormComparison;
  form?: InternalKoboImportedFormSummary;
  message?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(INTERNAL_KOBO_FORM_IMPORT_ENDPOINT, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function importInternalKoboXlsFormFromUrl(url: string): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: InternalKoboFormComparison;
  form?: InternalKoboImportedFormSummary;
  message?: string;
}> {
  const response = await apiClient.post(INTERNAL_KOBO_FORM_IMPORT_URL_ENDPOINT, { url });
  return response.data;
}

export async function createInternalKoboFormDefinition(payload: {
  title: string;
  description?: string;
  sector?: string;
  country?: string;
  sourceType?: string;
  activate?: boolean;
  survey?: Array<Record<string, unknown>>;
  choices?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: InternalKoboFormComparison;
  form?: InternalKoboImportedFormSummary;
  message?: string;
}> {
  const response = await apiClient.post(INTERNAL_KOBO_FORM_CREATE_ENDPOINT, payload);
  return response.data;
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
      nextRetryAt: undefined,
      errorType: undefined,
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
    nextRetryAt: undefined,
    errorType: undefined,
  });
}

export async function flushInternalKoboSubmissionQueue(): Promise<{
  flushed: number;
  failed: number;
  pending: number;
}> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const now = Date.now();
  const internalItems = queuedItems
    .filter(isInternalKoboQueueItem)
    .filter((item) => (item.retryCount || 0) < MAX_INTERNAL_KOBO_RETRIES)
    .filter((item) => !item.nextRetryAt || item.nextRetryAt <= now)
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
        const nextRetryCount = canRetry ? (item.retryCount || 0) + 1 : MAX_INTERNAL_KOBO_RETRIES;
        await db.syncOutbox.update(item.id, {
          status: 'failed',
          retryCount: nextRetryCount,
          lastError: canRetry
            ? getInternalKoboErrorMessage(error)
            : `Validation serveur: ${getInternalKoboErrorMessage(error)}`,
          errorType: getInternalKoboErrorType(error),
          lastAttemptAt: Date.now(),
          nextRetryAt: canRetry && nextRetryCount < MAX_INTERNAL_KOBO_RETRIES
            ? getInternalKoboNextRetryAt(nextRetryCount)
            : undefined,
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
    .map((item) => {
      const mediaBytes = getAttachmentBytes(item.payload);
      return {
      id: item.id,
      clientSubmissionId: item.payload.clientSubmissionId,
      householdId: item.payload.householdId,
      numeroOrdre: item.payload.numeroOrdre,
      role: item.payload.role,
      status: item.status,
      submissionStatus: item.payload.status,
      formKey: item.payload.formKey,
      formVersion: item.payload.formVersion,
      attachmentCount: item.payload.attachments?.length || 0,
      mediaBytes,
      retryCount: item.retryCount || 0,
      lastError: item.lastError,
      lastAttemptAt: item.lastAttemptAt,
      nextRetryAt: item.nextRetryAt,
      nextRetryInMs: item.nextRetryAt ? Math.max(0, item.nextRetryAt - Date.now()) : 0,
      errorType: item.errorType,
      timestamp: item.timestamp,
    };
    })
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

  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return draft;
  } catch {
    const compactDraft = {
      ...draft,
      values: compactDraftValues(draft.values) as Record<string, unknown>,
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(compactDraft));
      return compactDraft;
    } catch {
      return null;
    }
  }
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

export async function reportInternalKoboClientQueue(): Promise<void> {
  const queueItems = await getInternalKoboQueueItems();
  const pending = queueItems.filter((item) => item.status === 'pending').length;
  const failed = queueItems.filter((item) => item.status === 'failed' && item.retryCount < MAX_INTERNAL_KOBO_RETRIES).length;
  const blocked = queueItems.filter((item) => item.retryCount >= MAX_INTERNAL_KOBO_RETRIES).length;
  const mediaBytes = queueItems.reduce((total, item) => total + Number(item.mediaBytes || 0), 0);
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const connection = nav ? (nav as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection : null;

  await apiClient.post(INTERNAL_KOBO_CLIENT_QUEUE_ENDPOINT, {
    reportedAt: new Date().toISOString(),
    pending,
    failed,
    blocked,
    mediaBytes,
    queue: queueItems.slice(0, 100).map((item) => ({
      clientSubmissionId: item.clientSubmissionId,
      numeroOrdre: item.numeroOrdre,
      role: item.role,
      formKey: item.formKey,
      formVersion: item.formVersion,
      status: item.status,
      retryCount: item.retryCount,
      attachmentCount: item.attachmentCount,
      mediaBytes: item.mediaBytes,
      nextRetryAt: item.nextRetryAt,
      errorType: item.errorType,
      lastError: item.lastError,
    })),
    device: {
      online: nav ? nav.onLine : true,
      platform: nav?.platform || '',
      language: nav?.language || '',
      userAgent: nav?.userAgent || '',
      network: connection?.effectiveType || connection?.type || '',
    },
  });
}

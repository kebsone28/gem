import apiClient from '../api/client';
import { db, type SyncQueueItem } from '../store/db';

export type ToolboxSubmissionstatus = 'draft' | 'submitted' | 'validated' | 'rejected';

export interface toolboxAttachment {
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

export interface toolboxSubmissionPayload {
  clientSubmissionId: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey: string;
  formVersion: string;
  role?: string | null;
  status: ToolboxSubmissionstatus;
  values: Record<string, unknown>;
  attachments?: toolboxAttachment[];
  metadata?: Record<string, unknown>;
  requiredMissing: string[];
  householdPatch?: Record<string, unknown>;
}

export interface toolboxSubmissionResponse {
  success: boolean;
  submission?: Record<string, unknown>;
  household?: Record<string, unknown> | null;
  message?: string;
}

export interface ToolboxImportedFormSummary {
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

export interface ToolboxFormComparison {
  previous?: Record<string, unknown>;
  current?: Record<string, unknown>;
  summary?: Record<string, number>;
  fields?: Record<string, unknown[]>;
  choices?: Record<string, unknown[]>;
  diagnosticsDelta?: Record<string, unknown>;
}

export interface toolboxFormDefinitionInfo {
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
    importedForms: ToolboxImportedFormSummary[];
  };
}

export interface toolboxSubmissionRecord {
  id: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey: string;
  formVersion: string;
  clientSubmissionId: string;
  role?: string | null;
  status: ToolboxSubmissionstatus;
  syncStatus: string;
  values: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  attachments?: toolboxAttachment[];
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

export interface toolboxSubmissionDiagnostics {
  scope?: string;
  health?: 'ok' | 'warning' | 'critical' | string;
  total?: number;
  count?: number;
  pageCount?: number;
  offset?: number;
  limit?: number;
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
  activeForms?: ToolboxImportedFormSummary[];
  inactiveForms?: ToolboxImportedFormSummary[];
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

export interface toolboxSubmissionFilters {
  householdId?: string;
  numeroOrdre?: string;
  status?: ToolboxSubmissionstatus;
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
  offset?: number;
  mobileOnly?: string;
}

export interface ToolboxSubmissionsReport {
  submissions: toolboxSubmissionRecord[];
  diagnostics: toolboxSubmissionDiagnostics | null;
  count: number;
  pageCount?: number;
  offset?: number;
  limit?: number;
}

export interface toolboxQueuedSubmission {
  id?: number;
  clientSubmissionId: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  role?: string | null;
  status: 'pending' | 'failed';
  submissionStatus: ToolboxSubmissionstatus;
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

export interface toolboxLocalDraft {
  key: string;
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
  formVersion: string;
  values: Record<string, unknown>;
  updatedAt: string;
}

const TOOLBOX_OUTBOX_ACTION = 'toolbox-submit';
const TOOLBOX_SUBMISSION_ENDPOINT = '/toolbox/submissions';
const TOOLBOX_FORM_DEFINITION_ENDPOINT = '/toolbox/form-definition';
const TOOLBOX_FORM_DEFINITIONS_ENDPOINT = '/toolbox/form-definitions';
const TOOLBOX_FORM_CREATE_ENDPOINT = '/toolbox/form-definition/create';
const TOOLBOX_FORM_IMPORT_ENDPOINT = '/toolbox/form-definition/import';
const TOOLBOX_FORM_IMPORT_URL_ENDPOINT = '/toolbox/form-definition/import-url';
const TOOLBOX_DIAGNOSTICS_ENDPOINT = '/toolbox/diagnostics';
const TOOLBOX_CLIENT_QUEUE_ENDPOINT = '/toolbox/client-queue-report';
const TOOLBOX_DRAFT_PREFIX = 'ged-os-toolbox-draft:';
const MAX_TOOLBOX_RETRIES = 6;
const TOOLBOX_BASE_RETRY_DELAY_MS = 5000;
const TOOLBOX_MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

const getFilenameFromDisposition = (disposition?: string, fallback = 'soumissions-kobo-interne.csv') => {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

export function getToolboxErrorStatus(error: unknown): number | null {
  const status = (error as any)?.response?.status;
  return typeof status === 'number' ? status : null;
}

export function isRetriableToolboxError(error: unknown): boolean {
  const status = getToolboxErrorStatus(error);
  if (!status) return true;
  return status === 408 || status === 429 || status >= 500;
}

export function getToolboxErrorMessage(error: unknown): string {
  const responseMessage = (error as any)?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Erreur reseau inconnue';
}

function getToolboxErrorType(error: unknown): NonNullable<SyncQueueItem['errorType']> {
  const status = getToolboxErrorStatus(error);
  if (!status) return 'network';
  if (status === 409) return 'version';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

function getToolboxNextRetryAt(retryCount: number): number {
  const exponentialDelay = Math.min(
    TOOLBOX_MAX_RETRY_DELAY_MS,
    TOOLBOX_BASE_RETRY_DELAY_MS * 2 ** Math.max(retryCount, 0)
  );
  const jitter = Math.round(exponentialDelay * (0.15 + Math.random() * 0.25));
  return Date.now() + exponentialDelay + jitter;
}

function getAttachmentBytes(payload: toolboxSubmissionPayload): number {
  return (payload.attachments || []).reduce((total, attachment) => total + Number(attachment.storedBytes || attachment.originalBytes || 0), 0);
}

function isToolboxQueueItem(item: SyncQueueItem): item is SyncQueueItem & {
  payload: toolboxSubmissionPayload;
} {
  const payload = item.payload as Partial<toolboxSubmissionPayload>;
  return item.action === TOOLBOX_OUTBOX_ACTION && Boolean(payload?.clientSubmissionId);
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getToolboxDraftKeys(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
  includeLegacy?: boolean;
}): string[] {
  const keys: string[] = [];
  const householdId = String(params.householdId || '').trim();
  const numeroOrdre = String(params.numeroOrdre || '').trim();
  const formKey = String(params.formKey || '').trim();
  const role = String(params.role || '').trim();
  const scopeParts = [
    formKey ? `form:${formKey}` : '',
    role ? `role:${role}` : '',
  ].filter(Boolean);
  const scopedSuffix = scopeParts.length ? `:${scopeParts.join(':')}` : '';

  if (householdId) keys.push(`${TOOLBOX_DRAFT_PREFIX}household:${householdId}${scopedSuffix}`);
  if (numeroOrdre) keys.push(`${TOOLBOX_DRAFT_PREFIX}numero:${numeroOrdre}${scopedSuffix}`);

  if (scopedSuffix && params.includeLegacy !== false) {
    if (householdId) keys.push(`${TOOLBOX_DRAFT_PREFIX}household:${householdId}`);
    if (numeroOrdre) keys.push(`${TOOLBOX_DRAFT_PREFIX}numero:${numeroOrdre}`);
  }

  return keys;
}

function findtoolboxLocalDraftFallback(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
}): toolboxLocalDraft | null {
  if (!canUseLocalStorage()) return null;

  const householdId = String(params.householdId || '').trim();
  const numeroOrdre = String(params.numeroOrdre || '').trim();
  const formKey = String(params.formKey || '').trim();
  const role = String(params.role || '').trim();
  const matches: toolboxLocalDraft[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) || '';
    if (!key.startsWith(TOOLBOX_DRAFT_PREFIX)) continue;

    try {
      const draft = JSON.parse(window.localStorage.getItem(key) || '') as toolboxLocalDraft;
      if (!draft?.values || typeof draft.values !== 'object') continue;
      const draftHouseholdId = String(draft.householdId || '').trim();
      const draftNumeroOrdre = String(draft.numeroOrdre || '').trim();
      const draftFormKey = String(draft.formKey || draft.values?._ged_os_runtime_form_key || '').trim();
      const draftRole = String(draft.role || draft.values?.role || '').trim();

      const sameTarget = Boolean(
        (householdId && draftHouseholdId === householdId) ||
        (numeroOrdre && draftNumeroOrdre === numeroOrdre)
      );
      if (!sameTarget) continue;
      if (formKey && draftFormKey && draftFormKey !== formKey) continue;
      if (role && draftRole && draftRole !== role) continue;

      matches.push({ ...draft, key, formKey: draftFormKey || draft.formKey, role: draftRole || draft.role });
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return matches.sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))[0] || null;
}

function compactDraftValues(value: unknown, key = ''): unknown {
  if (key.startsWith('_ged_os_attachment_') && value && typeof value === 'object' && !Array.isArray(value)) {
    const attachment = value as toolboxAttachment;
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

export async function submittoolboxSubmission(
  payload: toolboxSubmissionPayload
): Promise<toolboxSubmissionResponse> {
  const response = await apiClient.post<toolboxSubmissionResponse>(
    TOOLBOX_SUBMISSION_ENDPOINT,
    payload
  );
  return response.data;
}

export async function fetchtoolboxFormDefinition(): Promise<toolboxFormDefinitionInfo | null> {
  const response = await apiClient.get<{
    success: boolean;
    form?: toolboxFormDefinitionInfo;
  }>(TOOLBOX_FORM_DEFINITION_ENDPOINT);

  return response.data.form || null;
}

export async function fetchtoolboxFormDefinitions(): Promise<NonNullable<toolboxFormDefinitionInfo['universalEngine']>['importedForms']> {
  const response = await apiClient.get<{
    success: boolean;
    forms?: NonNullable<toolboxFormDefinitionInfo['universalEngine']>['importedForms'];
  }>(TOOLBOX_FORM_DEFINITIONS_ENDPOINT);

  return response.data.forms || [];
}

export async function fetchToolboxImportedFormDefinition(formKey: string): Promise<Record<string, unknown> | null> {
  const response = await apiClient.get<{
    success: boolean;
    form?: Record<string, unknown>;
  }>(`${TOOLBOX_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}`);

  return response.data.form || null;
}

export async function updatetoolboxFormDefinitionStatus(
  formKey: string,
  active: boolean
): Promise<ToolboxImportedFormSummary | null> {
  const response = await apiClient.patch<{
    success: boolean;
    form?: ToolboxImportedFormSummary;
  }>(`${TOOLBOX_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}/status`, { active });

  return response.data.form || null;
}

export async function deletetoolboxFormDefinition(
  formKey: string
): Promise<ToolboxImportedFormSummary | null> {
  const response = await apiClient.delete<{
    success: boolean;
    form?: ToolboxImportedFormSummary;
  }>(`${TOOLBOX_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}`);

  return response.data.form || null;
}

export async function comparetoolboxFormDefinitions(
  formKey: string,
  targetFormKey: string
): Promise<ToolboxFormComparison | null> {
  const response = await apiClient.get<{
    success: boolean;
    comparison?: ToolboxFormComparison;
  }>(
    `${TOOLBOX_FORM_DEFINITIONS_ENDPOINT}/${encodeURIComponent(formKey)}/compare/${encodeURIComponent(targetFormKey)}`
  );

  return response.data.comparison || null;
}

export async function fetchToolboxSubmissionsReport(
  params: toolboxSubmissionFilters = {}
): Promise<ToolboxSubmissionsReport> {
  const response = await apiClient.get<{
    success: boolean;
    count?: number;
    pageCount?: number;
    offset?: number;
    limit?: number;
    submissions?: toolboxSubmissionRecord[];
    diagnostics?: toolboxSubmissionDiagnostics;
  }>(TOOLBOX_SUBMISSION_ENDPOINT, { params });

  return {
    submissions: response.data.submissions || [],
    diagnostics: response.data.diagnostics || null,
    count: response.data.count ?? response.data.submissions?.length ?? 0,
    pageCount: response.data.pageCount ?? response.data.submissions?.length ?? 0,
    offset: response.data.offset ?? params.offset ?? 0,
    limit: response.data.limit ?? params.limit,
  };
}

export async function fetchToolboxSubmissions(
  params: toolboxSubmissionFilters = {}
): Promise<toolboxSubmissionRecord[]> {
  const report = await fetchToolboxSubmissionsReport(params);
  return report.submissions;
}

export async function fetchToolboxDiagnostics(): Promise<toolboxSubmissionDiagnostics | null> {
  const response = await apiClient.get<{
    success: boolean;
    diagnostics?: toolboxSubmissionDiagnostics;
  }>(TOOLBOX_DIAGNOSTICS_ENDPOINT);

  return response.data.diagnostics || null;
}

export async function reviewtoolboxSubmission(
  id: string,
  status: Exclude<ToolboxSubmissionstatus, 'draft'>,
  note = ''
): Promise<toolboxSubmissionRecord | null> {
  const response = await apiClient.patch<{
    success: boolean;
    submission?: toolboxSubmissionRecord;
  }>(`${TOOLBOX_SUBMISSION_ENDPOINT}/${id}/review`, { status, note });

  return response.data.submission || null;
}

export async function downloadToolboxSubmissionsExport(
  params: toolboxSubmissionFilters & { columns?: string } = {},
  format: 'csv' | 'json' | 'xlsx' = 'csv'
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(`${TOOLBOX_SUBMISSION_ENDPOINT}/export`, {
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

export async function downloadToolboxMediaExport(
  params: toolboxSubmissionFilters = {}
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(`${TOOLBOX_SUBMISSION_ENDPOINT}/export-media`, {
    params,
    responseType: 'blob',
  });
  const fallback = `ged-os-media-${new Date().toISOString().slice(0, 10)}.zip`;

  return {
    blob: response.data,
    filename: getFilenameFromDisposition(response.headers?.['content-disposition'], fallback),
  };
}

export async function importToolboxXlsForm(file: File): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: ToolboxFormComparison;
  form?: ToolboxImportedFormSummary;
  message?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(TOOLBOX_FORM_IMPORT_ENDPOINT, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function importToolboxXlsFormFromUrl(url: string): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: ToolboxFormComparison;
  form?: ToolboxImportedFormSummary;
  message?: string;
}> {
  const response = await apiClient.post(TOOLBOX_FORM_IMPORT_URL_ENDPOINT, { url });
  return response.data;
}

export async function createtoolboxFormDefinition(payload: {
  title: string;
  description?: string;
  sector?: string;
  country?: string;
  sourceType?: string;
  activate?: boolean;
  defaultLanguage?: string;
  survey?: Array<Record<string, unknown>>;
  choices?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  importId?: string;
  storageKey?: string;
  comparison?: ToolboxFormComparison;
  form?: ToolboxImportedFormSummary;
  message?: string;
}> {
  const response = await apiClient.post(TOOLBOX_FORM_CREATE_ENDPOINT, payload);
  return response.data;
}

export async function queuetoolboxSubmission(
  payload: toolboxSubmissionPayload,
  reason?: string
): Promise<number | undefined> {
  const timestamp = Date.now();
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const existing = queuedItems.find(
    (item) =>
      isToolboxQueueItem(item) &&
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
    action: TOOLBOX_OUTBOX_ACTION,
    endpoint: TOOLBOX_SUBMISSION_ENDPOINT,
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

export async function flushtoolboxSubmissionQueue(): Promise<{
  flushed: number;
  failed: number;
  pending: number;
}> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const now = Date.now();
  const internalItems = queuedItems
    .filter(isToolboxQueueItem)
    .filter((item) => (item.retryCount || 0) < MAX_TOOLBOX_RETRIES)
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
        const canRetry = isRetriableToolboxError(error);
        const nextRetryCount = canRetry ? (item.retryCount || 0) + 1 : MAX_TOOLBOX_RETRIES;
        await db.syncOutbox.update(item.id, {
          status: 'failed',
          retryCount: nextRetryCount,
          lastError: canRetry
            ? getToolboxErrorMessage(error)
            : `Validation serveur: ${getToolboxErrorMessage(error)}`,
          errorType: getToolboxErrorType(error),
          lastAttemptAt: Date.now(),
          nextRetryAt: canRetry && nextRetryCount < MAX_TOOLBOX_RETRIES
            ? getToolboxNextRetryAt(nextRetryCount)
            : undefined,
          timestamp: Date.now(),
        });
      }
    }
  }

  const remaining = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();
  const pending = remaining.filter(isToolboxQueueItem).length;

  return { flushed, failed, pending };
}

export async function gettoolboxQueueItems(): Promise<toolboxQueuedSubmission[]> {
  const queuedItems = await db.syncOutbox.where('status').anyOf('pending', 'failed').toArray();

  return queuedItems
    .filter(isToolboxQueueItem)
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

export async function gettoolboxQueueCount(): Promise<number> {
  return gettoolboxQueueItems().then((items) => items.length);
}

export function savetoolboxLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
  formVersion: string;
  values: Record<string, unknown>;
}): toolboxLocalDraft | null {
  if (!canUseLocalStorage()) return null;

  const [key] = getToolboxDraftKeys(params);
  if (!key) return null;

  const draft: toolboxLocalDraft = {
    key,
    householdId: params.householdId,
    numeroOrdre: params.numeroOrdre,
    formKey: params.formKey,
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

export function loadtoolboxLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
}): toolboxLocalDraft | null {
  if (!canUseLocalStorage()) return null;

  for (const key of getToolboxDraftKeys(params)) {
    const rawDraft = window.localStorage.getItem(key);
    if (!rawDraft) continue;

    try {
      const draft = JSON.parse(rawDraft) as toolboxLocalDraft;
      if (draft?.values && typeof draft.values === 'object') {
        return { ...draft, key };
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return findtoolboxLocalDraftFallback(params);
}

export function cleartoolboxLocalDraft(params: {
  householdId?: string | null;
  numeroOrdre?: string | null;
  formKey?: string | null;
  role?: string | null;
}): void {
  if (!canUseLocalStorage()) return;

  getToolboxDraftKeys(params).forEach((key) => {
    window.localStorage.removeItem(key);
  });

  const fallback = findtoolboxLocalDraftFallback(params);
  if (fallback?.key) {
    window.localStorage.removeItem(fallback.key);
  }
}

export async function reportToolboxClientQueue(): Promise<void> {
  const queueItems = await gettoolboxQueueItems();
  const pending = queueItems.filter((item) => item.status === 'pending').length;
  const failed = queueItems.filter((item) => item.status === 'failed' && item.retryCount < MAX_TOOLBOX_RETRIES).length;
  const blocked = queueItems.filter((item) => item.retryCount >= MAX_TOOLBOX_RETRIES).length;
  const mediaBytes = queueItems.reduce((total, item) => total + Number(item.mediaBytes || 0), 0);
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const connection = nav ? (nav as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection : null;

  await apiClient.post(TOOLBOX_CLIENT_QUEUE_ENDPOINT, {
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

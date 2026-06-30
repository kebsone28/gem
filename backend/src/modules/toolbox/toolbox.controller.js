import logger from '../../utils/logger.js';
import prisma from '../../core/utils/prisma.js';
import eventBus from '../../core/utils/eventBus.js';
import { tracerAction } from '../../services/audit.service.js';
import { triggerWebhooks } from '../../services/webhook.service.js';
import { uploadFile, getFileUrl, getFileStream } from '../../services/storage.service.js';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import {
  getServerRequiredMissing,
  getServerValidationIssues,
  TOOLBOX_ALLOWED_ROLES,
  TOOLBOX_FORM_KEY,
  TOOLBOX_FORM_VERSION,
} from './toolbox.validation.js';
import {
  buildXlsFormDefinition,
  compareXlsFormDefinitions,
  parseXlsFormBuffer,
  validateXlsFormValues,
  XLSFORM_ENGINE_VERSION,
} from './xlsFormEngine.js';

const SUBMISSION_STATUSES = new Set(['draft', 'submitted', 'validated', 'rejected']);
const REVIEW_STATUSES = new Set(['submitted', 'validated', 'rejected']);
const MAX_EMBEDDED_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_XLSFORM_REMOTE_BYTES = 20 * 1024 * 1024;
const FINAL_SUBMISSION_STATUSES = new Set(['submitted', 'validated']);
const OMIT_FIELD = Symbol('omit-field');

function sanitizeBigIntForJson(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitizeBigIntForJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, sanitizeBigIntForJson(entryValue)])
    );
  }
  return value;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeJsonField(existingValue, nextValue) {
  if (!isPlainObject(existingValue) || !isPlainObject(nextValue)) {
    return nextValue;
  }
  return { ...existingValue, ...nextValue };
}

function normalizeNumeroVariants(numeroOrdre) {
  const normalized = String(numeroOrdre || '').trim();
  if (!normalized) return [];

  return Array.from(new Set([normalized, normalized.replace(/^0+/, '') || normalized]));
}

async function resolveHousehold(tx, { organizationId, householdId, numeroOrdre }) {
  if (householdId) {
    const household = await tx.household.findFirst({
      where: { id: String(householdId), organizationId, deletedAt: null },
    });
    if (household) return household;
  }

  const numeroVariants = normalizeNumeroVariants(numeroOrdre);
  if (numeroVariants.length === 0) return null;

  return tx.household.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: numeroVariants.map((value) => ({
        numeroordre: { equals: value, mode: 'insensitive' },
      })),
    },
  });
}

function buildSafeHouseholdUpdate(household, patch) {
  if (!isPlainObject(patch)) return null;

  const data = {
    version: (household.version || 0) + 1,
  };

  if (typeof patch.status === 'string' && patch.status.trim()) {
    data.status = patch.status.trim();
  }

  if (patch.koboData !== undefined) {
    data.koboData = mergeJsonField(household.koboData || {}, patch.koboData || {});
  }

  if (patch.koboSync !== undefined) {
    data.koboSync = mergeJsonField(household.koboSync || {}, patch.koboSync || {});
  }

  if (patch.constructionData !== undefined) {
    data.constructionData = mergeJsonField(
      household.constructionData || {},
      patch.constructionData || {}
    );
  }

  return data;
}

function normalizeRequiredMissing(requiredMissing) {
  if (!Array.isArray(requiredMissing)) return [];
  return requiredMissing.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeBuilderKey(value, fallback = 'ged_os_form') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_') // Allow underscores
    // .replace(/^_+|_+$/g, '') // Preserve leading/trailing underscores
    .slice(0, 72);
  return normalized || `${fallback}_${crypto.randomUUID().slice(0, 8)}`;
}

function makeHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function findUniversalXlsFormDefinition(organizationId, formKey) {
  const mapping = await prisma.koboFormMapping.findFirst({
    where: {
      organizationId,
      koboAssetId: formKey,
    },
  });

  if (!mapping || !isPlainObject(mapping.mapping)) return null;
  if (isUniversalXlsFormDeleted(mapping.mapping)) return null;
  return {
    id: mapping.id,
    koboAssetId: mapping.koboAssetId,
    version: mapping.version,
    lastValidated: mapping.lastValidated,
    updatedAt: mapping.updatedAt,
    definition: mapping.mapping,
  };
}

function isUniversalXlsFormActive(definition) {
  return definition?.lifecycle?.active !== false;
}

function isUniversalXlsFormDeleted(definition) {
  return Boolean(definition?.lifecycle?.deletedAt || definition?.lifecycle?.status === 'deleted');
}

function filterVisibleUniversalXlsFormMappings(mappings = []) {
  return mappings.filter((mapping) => !isUniversalXlsFormDeleted(mapping.mapping));
}

function buildDefinitionSummary(definition = {}) {
  return {
    formKey: definition.formKey || '',
    formVersion: definition.formVersion || '',
    title: definition.title || definition.formKey || '',
    fieldCount: Number(definition.diagnostics?.fieldCount || 0),
    choiceCount: Number(definition.diagnostics?.choiceCount || 0),
    requiredCount: Number(definition.diagnostics?.requiredCount || 0),
    importedAt: definition.importedAt || null,
    engineVersion: definition.engineVersion || XLSFORM_ENGINE_VERSION,
  };
}

function buildImportHistoryEntry({
  definition,
  importId,
  userId,
  fileName,
  storageKey,
  sourceHash,
}) {
  return {
    importId,
    formKey: definition.formKey,
    formVersion: definition.formVersion,
    title: definition.title,
    importedAt: definition.importedAt,
    importedById: userId,
    fileName,
    storageKey,
    sourceHash,
    engine: definition.engine,
    engineVersion: definition.engineVersion,
    diagnostics: definition.diagnostics || {},
  };
}

function mergeImportHistory(existingDefinition, nextEntry) {
  const existingHistory = Array.isArray(existingDefinition?.importHistory)
    ? existingDefinition.importHistory
    : [];
  return [nextEntry, ...existingHistory].slice(0, 25);
}

function summarizeUniversalXlsFormMapping(mapping) {
  const definition = isPlainObject(mapping.mapping) ? mapping.mapping : {};
  const latestImport = Array.isArray(definition.importHistory) ? definition.importHistory[0] : null;
  const active = isUniversalXlsFormActive(definition);
  return {
    id: mapping.id,
    formKey: mapping.koboAssetId,
    formVersion: mapping.version,
    title: definition.title || mapping.koboAssetId,
    engine: definition.engine || 'ged-os-xlsform-universal',
    engineVersion: definition.engineVersion || XLSFORM_ENGINE_VERSION,
    active,
    status: definition.lifecycle?.status || (active ? 'active' : 'inactive'),
    importedAt: definition.importedAt || null,
    importedById: definition.lifecycle?.importedById || latestImport?.importedById || null,
    storageKey: latestImport?.storageKey || definition.source?.storageKey || null,
    historyCount: Array.isArray(definition.importHistory) ? definition.importHistory.length : 0,
    latestImport,
    previousDefinitionSummary: definition.previousDefinitionSummary || null,
    previousComparisonSummary: definition.previousComparisonSummary || null,
    diagnostics: definition.diagnostics || {},
    capabilities: definition.capabilities || [],
    lastValidated: mapping.lastValidated,
    updatedAt: mapping.updatedAt,
  };
}

function sanitizeObjectWithValuePatch(value, valuePatch = {}, key = '') {
  if (key && key.startsWith('_ged_os_attachment_')) return OMIT_FIELD;
  if (key && Object.prototype.hasOwnProperty.call(valuePatch, key)) return valuePatch[key];
  if (typeof value === 'string' && value.startsWith('data:')) return '[media stored as attachment]';
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeObjectWithValuePatch(item, valuePatch))
      .filter((item) => item !== OMIT_FIELD);
  }
  if (!isPlainObject(value)) return value;

  const next = {};
  Object.entries(value).forEach(([entryKey, entryValue]) => {
    const sanitized = sanitizeObjectWithValuePatch(entryValue, valuePatch, entryKey);
    if (sanitized !== OMIT_FIELD) next[entryKey] = sanitized;
  });
  return next;
}

function extensionFromMime(mimeType = '') {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('audio/mpeg')) return 'mp3';
  if (mimeType.includes('audio/')) return 'webm';
  if (mimeType.includes('video/mp4')) return 'mp4';
  if (mimeType.includes('video/')) return 'webm';
  return 'jpg';
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType: match[1], buffer };
}

async function normalizeSubmissionAttachments({
  attachments,
  organizationId,
  clientSubmissionId,
  values,
}) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { attachments: [], valuePatch: {} };
  }

  const normalized = [];
  const valuePatch = {};
  const pathPatches = [];
  const seenHashes = new Set();

  for (const rawAttachment of attachments) {
    if (!isPlainObject(rawAttachment)) continue;

    const fieldName = String(rawAttachment.fieldName || '').trim();
    const fileName = String(
      rawAttachment.fileName || `${fieldName || 'piece'}-${Date.now()}`
    ).trim();
    const mimeType = String(rawAttachment.mimeType || '').trim() || 'application/octet-stream';
    const capturedAt = rawAttachment.capturedAt || new Date().toISOString();
    const baseRecord = {
      id: String(rawAttachment.id || crypto.randomUUID()),
      fieldName,
      fieldCode: rawAttachment.fieldCode ? String(rawAttachment.fieldCode) : fieldName,
      valuePath: Array.isArray(rawAttachment.valuePath)
        ? rawAttachment.valuePath.map((entry) =>
            typeof entry === 'number' ? entry : String(entry)
          )
        : null,
      fileName,
      mimeType,
      originalBytes: Number(rawAttachment.originalBytes || rawAttachment.size || 0) || null,
      storedBytes: Number(rawAttachment.storedBytes || rawAttachment.size || 0) || null,
      capturedAt,
      source: rawAttachment.source || 'ged-os-toolbox',
      status: 'stored',
    };

    if (rawAttachment.url || rawAttachment.key) {
      normalized.push({
        ...baseRecord,
        key: rawAttachment.key || null,
        url: rawAttachment.url || values?.[fieldName] || null,
        storage: rawAttachment.key ? 'remote' : 'external',
        sha256: rawAttachment.sha256 || null,
        duplicate: rawAttachment.sha256 ? seenHashes.has(String(rawAttachment.sha256)) : false,
      });
      if (rawAttachment.sha256) seenHashes.add(String(rawAttachment.sha256));
      const directPatch =
        !baseRecord.valuePath ||
        (baseRecord.valuePath.length === 1 && String(baseRecord.valuePath[0]) === fieldName);
      if (fieldName && rawAttachment.url && directPatch) valuePatch[fieldName] = rawAttachment.url;
      if (baseRecord.valuePath && rawAttachment.url)
        pathPatches.push({ path: baseRecord.valuePath, value: rawAttachment.url });
      continue;
    }

    const parsed = parseDataUrl(rawAttachment.dataUrl);
    if (!parsed) {
      normalized.push({
        ...baseRecord,
        status: 'unresolved',
        storage: 'client-reference',
        url: values?.[fieldName] || null,
      });
      continue;
    }

    if (parsed.buffer.length > MAX_EMBEDDED_ATTACHMENT_BYTES) {
      throw makeHttpError(
        413,
        `Attachment ${fieldName || fileName} exceeds the internal Kobo size limit`
      );
    }

    const extension = extensionFromMime(parsed.mimeType || mimeType);
    const sha256 = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
    if (rawAttachment.sha256 && String(rawAttachment.sha256) !== sha256) {
      throw makeHttpError(400, `Attachment ${fieldName || fileName} checksum mismatch`);
    }
    const duplicate = seenHashes.has(sha256);
    seenHashes.add(sha256);
    const key = `${organizationId}/toolbox/media/${sha256}.${extension}`;
    await uploadFile(key, parsed.buffer, parsed.mimeType || mimeType);
    const url = await getFileUrl(key);

    normalized.push({
      ...baseRecord,
      mimeType: parsed.mimeType || mimeType,
      storedBytes: parsed.buffer.length,
      sha256,
      key,
      url,
      storage: 'server',
      duplicate,
    });
    const directPatch =
      !baseRecord.valuePath ||
      (baseRecord.valuePath.length === 1 && String(baseRecord.valuePath[0]) === fieldName);
    if (fieldName && url && directPatch) valuePatch[fieldName] = url;
    if (baseRecord.valuePath && url) pathPatches.push({ path: baseRecord.valuePath, value: url });
  }

  return { attachments: normalized, valuePatch, pathPatches };
}

function applyPathPatch(target, path, value) {
  if (!Array.isArray(path) || path.length === 0) return target;
  const next = Array.isArray(target) ? [...target] : { ...(isPlainObject(target) ? target : {}) };
  let cursor = next;
  path.forEach((segment, index) => {
    const isLast = index === path.length - 1;
    if (isLast) {
      cursor[segment] = value;
      return;
    }
    const nextSegment = path[index + 1];
    const shouldBeArray = typeof nextSegment === 'number';
    const existing = cursor[segment];
    if (shouldBeArray) {
      cursor[segment] = Array.isArray(existing) ? [...existing] : [];
    } else {
      cursor[segment] = isPlainObject(existing) ? { ...existing } : {};
    }
    cursor = cursor[segment];
  });
  return next;
}

function applyValuePatches(values, valuePatch = {}, pathPatches = []) {
  let nextValues = { ...values, ...valuePatch };
  pathPatches.forEach((patch) => {
    nextValues = applyPathPatch(nextValues, patch.path, patch.value);
  });
  return nextValues;
}

function summarizeAttachmentStats(attachments = []) {
  const hashes = new Set();
  return attachments.reduce(
    (acc, attachment) => {
      acc.attachmentCount += 1;
      acc.totalStoredBytes += Number(attachment.storedBytes || 0);
      if (attachment.storage === 'server' || attachment.storage === 'remote')
        acc.serverStoredCount += 1;
      if (attachment.status === 'unresolved') acc.unresolvedCount += 1;
      if (attachment.sha256) {
        if (hashes.has(attachment.sha256)) acc.duplicateHashCount += 1;
        hashes.add(attachment.sha256);
      }
      return acc;
    },
    {
      attachmentCount: 0,
      serverStoredCount: 0,
      unresolvedCount: 0,
      totalStoredBytes: 0,
      duplicateHashCount: 0,
    }
  );
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function flattenSubmissionForExport(submission, valueKeys = [], columns = null) {
  const values = isPlainObject(submission.values) ? submission.values : {};
  const metadata = isPlainObject(submission.metadata) ? submission.metadata : {};
  const attachments = metadata?.media?.attachments || [];
  const row = {
    id: submission.id,
    clientSubmissionId: submission.clientSubmissionId,
    numeroOrdre:
      submission.numeroOrdre ||
      submission.household?.numeroordre ||
      values.Numero_ordre ||
      values.numero_ordre ||
      values.numeroordre ||
      values.order_number ||
      '',
    householdName: submission.household?.name || values.nom_key || values.nom || values.name || '',
    telephone:
      submission.household?.phone || values.telephone_key || values.telephone || values.phone || '',
    region: submission.household?.region || values.region_key || values.region || '',
    role: submission.role || values.role || '',
    status: submission.status,
    syncStatus: submission.syncStatus,
    formVersion: submission.formVersion,
    requiredMissing: (submission.requiredMissing || []).join('|'),
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    attachmentUrls: Array.isArray(attachments)
      ? attachments
          .map((item) => item.url || item.key)
          .filter(Boolean)
          .join('|')
      : '',
    submittedBy: submission.submittedBy?.name || submission.submittedBy?.email || '',
    submittedAt: submission.submittedAt?.toISOString?.() || submission.submittedAt || '',
    savedAt: submission.savedAt?.toISOString?.() || submission.savedAt || '',
    reviewStatus: metadata.review?.status || '',
    reviewNote: metadata.review?.note || '',
  };

  valueKeys.forEach((key) => {
    const value = values[key];
    row[`value.${key}`] = Array.isArray(value)
      ? value.join('|')
      : isPlainObject(value)
        ? JSON.stringify(value)
        : (value ?? '');
  });

  if (columns) {
    const colSet = new Set(columns);
    return Object.fromEntries(Object.entries(row).filter(([k]) => colSet.has(k)));
  }

  return row;
}

async function normalizeSubmissionPayload(body, req) {
  const clientSubmissionId = String(body.clientSubmissionId || '').trim();
  const formVersion = String(body.formVersion || '').trim();
  const formKey = String(body.formKey || TOOLBOX_FORM_KEY).trim() || TOOLBOX_FORM_KEY;

  if (!clientSubmissionId) {
    return { error: { status: 400, message: 'clientSubmissionId is required' } };
  }

  if (!formVersion) {
    return { error: { status: 400, message: 'formVersion is required' } };
  }

  if (!isPlainObject(body.values)) {
    return { error: { status: 400, message: 'values must be an object' } };
  }

  const universalMapping =
    formKey === TOOLBOX_FORM_KEY
      ? null
      : await findUniversalXlsFormDefinition(req.user.organizationId, formKey);

  if (formKey !== TOOLBOX_FORM_KEY && !universalMapping) {
    return { error: { status: 400, message: `Unsupported formKey: ${formKey}` } };
  }

  if (universalMapping && !isUniversalXlsFormActive(universalMapping.definition)) {
    return { error: { status: 409, message: `Inactive XLSForm definition: ${formKey}` } };
  }

  const requestedStatus = String(body.status || '')
    .trim()
    .toLowerCase();
  const serverFormVersion = universalMapping?.definition?.formVersion || TOOLBOX_FORM_VERSION;

  if (
    universalMapping &&
    FINAL_SUBMISSION_STATUSES.has(requestedStatus) &&
    formVersion !== serverFormVersion
  ) {
    return {
      error: {
        status: 409,
        message: 'Outdated XLSForm version: migrate the local draft before final submission',
        details: {
          formKey,
          clientFormVersion: formVersion,
          serverFormVersion,
          policy: 'block-final-submission-on-version-mismatch',
        },
      },
    };
  }

  const { attachments, valuePatch, pathPatches } = await normalizeSubmissionAttachments({
    attachments: body.attachments,
    organizationId: req.user.organizationId,
    clientSubmissionId,
    values: body.values,
  });
  const patchedValues = applyValuePatches(body.values, valuePatch, pathPatches);
  const values = sanitizeObjectWithValuePatch(patchedValues, valuePatch);

  const roleSource = body.role ?? values.role;
  const role = roleSource ? String(roleSource).trim() : null;
  if (formKey === TOOLBOX_FORM_KEY && role && !TOOLBOX_ALLOWED_ROLES.has(role)) {
    return { error: { status: 400, message: `Unsupported role: ${role}` } };
  }

  const universalValidation = universalMapping
    ? validateXlsFormValues(universalMapping.definition, values)
    : null;
  const serverValidationIssues = universalValidation?.issues || getServerValidationIssues(values);
  const serverRequiredMissing =
    universalValidation?.requiredMissing || getServerRequiredMissing(values);
  const serverConstraintIssues = serverValidationIssues.filter(
    (issue) => issue.type === 'constraint'
  );
  const requiredMissing = uniqueStrings([
    ...normalizeRequiredMissing(body.requiredMissing),
    ...serverRequiredMissing,
  ]);

  if (serverValidationIssues.length > 0 && ['submitted', 'validated'].includes(requestedStatus)) {
    return {
      error: {
        status: 422,
        message: 'Submitted internal Kobo form still has validation issues',
        details: {
          requiredMissing,
          validationIssues: serverValidationIssues,
        },
      },
    };
  }

  const status = SUBMISSION_STATUSES.has(requestedStatus)
    ? requestedStatus
    : serverValidationIssues.length > 0
      ? 'draft'
      : 'submitted';
  const mediaStats = summarizeAttachmentStats(attachments);

  return {
    payload: {
      clientSubmissionId,
      formKey,
      formVersion,
      householdId: body.householdId ? String(body.householdId) : null,
      numeroOrdre: body.numeroOrdre ? String(body.numeroOrdre).trim() : null,
      role,
      status,
      syncStatus: 'synced',
      values,
      metadata: {
        ...(isPlainObject(body.metadata) ? body.metadata : {}),
        serverFormKey: formKey,
        serverEngine: universalMapping ? 'ged-os-xlsform-universal' : 'ged-os-toolbox',
        serverEngineVersion: universalMapping?.definition?.engineVersion || XLSFORM_ENGINE_VERSION,
        serverFormKeyResolved: universalMapping?.definition?.formKey || TOOLBOX_FORM_KEY,
        serverFormVersion,
        formVersionMismatch: formVersion !== serverFormVersion,
        universalFormDiagnostics: universalMapping?.definition?.diagnostics || null,
        media: {
          ...(isPlainObject(body.metadata?.media) ? body.metadata.media : {}),
          attachments,
          attachmentCount: attachments.length,
          ...mediaStats,
        },
        serverRequiredMissing,
        serverValidationIssues,
        serverConstraintIssues,
        unresolvedCalculations: universalValidation?.unresolvedCalculations || [],
        requestId: req.get('x-request-id') || crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
        receivedFromIp: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
      requiredMissing,
      submittedAt: ['submitted', 'validated'].includes(status) ? new Date() : null,
      savedAt: new Date(),
      householdPatch: sanitizeObjectWithValuePatch(body.householdPatch, valuePatch),
    },
  };
}

export const submitToolboxSubmission = async (req, res) => {
  const { organizationId, id: userId } = req.user;
  let normalized;
  try {
    normalized = await normalizeSubmissionPayload(req.body || {}, req);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? 'Server error while preparing internal Kobo submission' : err.message,
    });
  }

  const { payload, error } = normalized;

  if (error) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message, details: error.details });
  }

  try {
    let updatedHousehold = null;

    const submission = await prisma.$transaction(async (tx) => {
      const resolvedHousehold = await resolveHousehold(tx, {
        organizationId,
        householdId: payload.householdId,
        numeroOrdre: payload.numeroOrdre,
      });

      if (resolvedHousehold && payload.numeroOrdre) {
        const numeroVariants = normalizeNumeroVariants(payload.numeroOrdre).map((value) =>
          value.toLowerCase()
        );
        const resolvedNumero = String(resolvedHousehold.numeroordre || '')
          .trim()
          .toLowerCase();
        if (resolvedNumero && !numeroVariants.includes(resolvedNumero)) {
          throw makeHttpError(409, 'Household target does not match submitted numeroOrdre');
        }
      }

      if (
        payload.formKey === TOOLBOX_FORM_KEY &&
        ['submitted', 'validated'].includes(payload.status) &&
        !resolvedHousehold
      ) {
        throw makeHttpError(404, 'Submitted internal Kobo form must target an existing household');
      }

      const existingSubmission = await tx.toolboxSubmission.findFirst({
        where: {
          organizationId,
          clientSubmissionId: payload.clientSubmissionId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (['validated', 'rejected'].includes(existingSubmission?.status)) {
        throw makeHttpError(409, 'Final reviewed internal Kobo submission cannot be overwritten');
      }

      if (existingSubmission?.status === 'submitted' && payload.status !== 'submitted') {
        throw makeHttpError(
          409,
          'Submitted internal Kobo form cannot be downgraded or reviewed by the submit endpoint'
        );
      }

      const submissionRecord = await tx.toolboxSubmission.upsert({
        where: {
          organizationId_clientSubmissionId: {
            organizationId,
            clientSubmissionId: payload.clientSubmissionId,
          },
        },
        create: {
          organizationId,
          householdId: resolvedHousehold?.id || null,
          numeroOrdre: resolvedHousehold?.numeroordre || payload.numeroOrdre,
          formKey: payload.formKey,
          formVersion: payload.formVersion,
          clientSubmissionId: payload.clientSubmissionId,
          role: payload.role,
          status: payload.status,
          syncStatus: payload.syncStatus,
          values: payload.values,
          metadata: payload.metadata,
          requiredMissing: payload.requiredMissing,
          submittedById: userId,
          submittedAt: payload.submittedAt,
          savedAt: payload.savedAt,
        },
        update: {
          householdId: resolvedHousehold?.id || null,
          numeroOrdre: resolvedHousehold?.numeroordre || payload.numeroOrdre,
          formKey: payload.formKey,
          formVersion: payload.formVersion,
          role: payload.role,
          status: payload.status,
          syncStatus: payload.syncStatus,
          values: payload.values,
          metadata: payload.metadata,
          requiredMissing: payload.requiredMissing,
          submittedById: userId,
          submittedAt: payload.submittedAt,
          savedAt: payload.savedAt,
        },
      });

      if (resolvedHousehold && payload.householdPatch) {
        const householdUpdate = buildSafeHouseholdUpdate(resolvedHousehold, payload.householdPatch);
        if (householdUpdate) {
          updatedHousehold = await tx.household.update({
            where: { id: resolvedHousehold.id },
            data: householdUpdate,
          });
        }
      }

      await tx.syncLog.create({
        data: {
          userId,
          organizationId,
          deviceId: String(payload.metadata?.deviceId || 'ged-os-toolbox'),
          action: 'TOOLBOX_SUBMISSION',
          details: {
            submissionId: submissionRecord.id,
            clientSubmissionId: payload.clientSubmissionId,
            householdId: resolvedHousehold?.id || null,
            numeroOrdre: resolvedHousehold?.numeroordre || payload.numeroOrdre,
            status: payload.status,
            formVersion: payload.formVersion,
            requiredMissing: payload.requiredMissing,
            validationIssues: payload.metadata.serverValidationIssues,
            serverFormVersion: payload.metadata.serverFormVersion,
            media: payload.metadata.media,
            formVersionMismatch: payload.metadata.formVersionMismatch,
          },
        },
      });

      return submissionRecord;
    });

    if (updatedHousehold) {
      try {
        eventBus.emit('household:upsert', {
          action: 'update',
          household: sanitizeBigIntForJson(updatedHousehold),
        });
      } catch (eventError) {
        logger.error('[TOOLBOX] event emit error:', eventError.message);
      }
    }

    try {
      await tracerAction({
        userId,
        organizationId,
        action: 'SOUMISSION_KOBO_INTERNE',
        resource: 'ToolboxSubmission',
        resourceId: submission.id,
        details: {
          clientSubmissionId: payload.clientSubmissionId,
          householdId: updatedHousehold?.id || payload.householdId || null,
          status: payload.status,
          formVersion: payload.formVersion,
          requiredMissing: payload.requiredMissing,
          validationIssues: payload.metadata.serverValidationIssues,
          formVersionMismatch: payload.metadata.formVersionMismatch,
        },
        req,
      });
    } catch (auditError) {
      logger.error('[TOOLBOX] audit log error:', auditError.message);
    }

    try {
      // Webhooks via webhook.service.js (HMAC + retry + queue)
      const hooks = await prisma.toolboxFormHook.findMany({
        where: { organizationId, formKey: payload.formKey, active: true },
      });
      if (hooks.length > 0) {
        const submissionData = sanitizeBigIntForJson(submission);
        const webhookConfigs = hooks.map((hook) => ({
          url: hook.url,
          secret: hook.secret || undefined,
          events: hook.events || ['submission.create'],
          timeout: 10000,
        }));
        triggerWebhooks(webhookConfigs, {
          event: 'submission.create',
          formKey: payload.formKey,
          submissionId: submission.id,
          clientSubmissionId: payload.clientSubmissionId,
          timestamp: new Date().toISOString(),
          data: submissionData,
        })
          .then(async (result) => {
            logger.info(`[TOOLBOX] Webhooks: ${result.sent} sent, ${result.failed} failed`);
            // Update hook statuses
            for (const hook of hooks) {
              await prisma.toolboxFormHook
                .update({
                  where: { id: hook.id },
                  data: { lastTriggeredAt: new Date() },
                })
                .catch(() => {});
            }
          })
          .catch((err) => {
            logger.error('[TOOLBOX] webhook trigger error:', err.message);
          });
      }
    } catch (hookError) {
      logger.error('[TOOLBOX] hook find error:', hookError.message);
    }

    return res.status(201).json({
      success: true,
      submission: sanitizeBigIntForJson(submission),
      household: updatedHousehold ? sanitizeBigIntForJson(updatedHousehold) : null,
    });
  } catch (err) {
    logger.error('[TOOLBOX] submit error:', err?.message || err, err?.stack || 'no-stack');
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? 'Server error while saving internal Kobo submission' : err.message,
    });
  }
};

export const getToolboxFormDefinition = async (req, res) => {
  try {
    const importedMappings = await prisma.koboFormMapping.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const importedForms = filterVisibleUniversalXlsFormMappings(importedMappings)
      .slice(0, 20)
      .map(summarizeUniversalXlsFormMapping);

    return res.json({
      success: true,
      form: {
        formKey: TOOLBOX_FORM_KEY,
        formVersion: TOOLBOX_FORM_VERSION,
        engine: 'ged-os-toolbox',
        allowedRoles: Array.from(TOOLBOX_ALLOWED_ROLES),
        serverValidation: true,
        xlsFormImport: true,
        universalEngine: {
          enabled: true,
          engine: 'ged-os-xlsform-universal',
          engineVersion: XLSFORM_ENGINE_VERSION,
          importedForms,
          capabilities: [
            'multi-form',
            'survey',
            'choices',
            'settings',
            'relevant',
            'required',
            'constraint',
            'calculate-basic',
            'choice_filter',
            'groups',
            'repeats',
            'media',
          ],
        },
        media: {
          embeddedOfflineMedia: true,
          maxEmbeddedAttachmentBytes: MAX_EMBEDDED_ATTACHMENT_BYTES,
        },
      },
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition error:', err?.message || err, err?.stack || 'no-stack');
    return res.status(500).json({
      success: false,
      message: 'Server error while loading internal Kobo form definition',
    });
  }
};

export const listToolboxFormDefinitions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

    const [mappings, total] = await Promise.all([
      prisma.koboFormMapping.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.koboFormMapping.count({ where: { organizationId } }),
    ]);
    const visibleMappings = filterVisibleUniversalXlsFormMappings(mappings);

    return res.json({
      success: true,
      count: visibleMappings.length,
      total,
      offset,
      limit,
      forms: visibleMappings.map(summarizeUniversalXlsFormMapping),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definitions list error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while listing XLSForm definitions',
    });
  }
};

export const reportToolboxClientQueue = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const pending = Math.max(0, Number(req.body?.pending || 0));
    const failed = Math.max(0, Number(req.body?.failed || 0));
    const blocked = Math.max(0, Number(req.body?.blocked || 0));
    const mediaBytes = Math.max(0, Number(req.body?.mediaBytes || 0));
    const queue = Array.isArray(req.body?.queue) ? req.body.queue.slice(0, 100) : [];
    const device = isPlainObject(req.body?.device) ? req.body.device : {};
    const reportedAt = String(req.body?.reportedAt || new Date().toISOString());

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: String(device.userAgent || device.platform || 'ged-os-toolbox-client').slice(
          0,
          160
        ),
        action: 'TOOLBOX_CLIENT_QUEUE_REPORT',
        details: {
          reportedAt,
          pending,
          failed,
          blocked,
          mediaBytes,
          device,
          queue,
        },
      },
    });

    return res.json({
      success: true,
      receivedAt: new Date().toISOString(),
      summary: { pending, failed, blocked, mediaBytes, count: queue.length },
    });
  } catch (err) {
    logger.error('[TOOLBOX] client queue report error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while reporting internal Kobo client queue',
    });
  }
};

export const getToolboxImportedFormDefinition = async (req, res) => {
  try {
    const formKey = String(req.params.formKey || '').trim();
    const mapping = await findUniversalXlsFormDefinition(req.user.organizationId, formKey);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'XLSForm definition not found',
      });
    }

    return res.json({
      success: true,
      form: sanitizeBigIntForJson(mapping.definition),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition get error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while loading XLSForm definition',
    });
  }
};

export const updateToolboxFormDefinitionStatus = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const formKey = String(req.params.formKey || '').trim();
    const active = req.body?.active;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'active must be a boolean',
      });
    }

    const mapping = await prisma.koboFormMapping.findFirst({
      where: {
        organizationId,
        koboAssetId: formKey,
      },
    });

    if (!mapping || !isPlainObject(mapping.mapping) || isUniversalXlsFormDeleted(mapping.mapping)) {
      return res.status(404).json({
        success: false,
        message: 'XLSForm definition not found',
      });
    }

    const now = new Date().toISOString();
    const previousActive = isUniversalXlsFormActive(mapping.mapping);
    const nextDefinition = {
      ...mapping.mapping,
      lifecycle: {
        ...(mapping.mapping.lifecycle || {}),
        active,
        status: active ? 'active' : 'inactive',
        importedById: mapping.mapping.lifecycle?.importedById || null,
        [active ? 'activatedAt' : 'deactivatedAt']: now,
        [active ? 'activatedById' : 'deactivatedById']: userId,
      },
    };

    const updatedMapping = await prisma.koboFormMapping.update({
      where: { id: mapping.id },
      data: {
        mapping: nextDefinition,
        lastValidated: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'ged-os-toolbox-admin',
        action: 'TOOLBOX_XLSFORM_STATUS',
        details: {
          formKey,
          previousActive,
          active,
          status: nextDefinition.lifecycle.status,
        },
      },
    });

    return res.json({
      success: true,
      form: summarizeUniversalXlsFormMapping(updatedMapping),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating XLSForm status',
    });
  }
};

/**
 * PUT /form-definitions/:formKey
 * Mise à jour générique d'une définition de formulaire
 */
export const updateToolboxFormDefinition = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const formKey = String(req.params.formKey || '').trim();

    if (!formKey) {
      return res.status(400).json({ success: false, message: 'formKey is required' });
    }

    const mapping = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId: formKey },
    });

    if (!mapping || !isPlainObject(mapping.mapping) || isUniversalXlsFormDeleted(mapping.mapping)) {
      return res.status(404).json({ success: false, message: 'Formulaire non trouvé' });
    }

    const current = mapping.mapping;
    const updateFields = req.body;

    // Fusionner les champs mis à jour dans la définition existante
    const nextDefinition = {
      ...current,
      ...updateFields,
      lifecycle: {
        ...(current.lifecycle || {}),
        updatedAt: new Date().toISOString(),
        updatedById: userId,
      },
    };

    // Si un titre est fourni, le propager dans settings
    if (updateFields.title) {
      nextDefinition.settings = {
        ...(current.settings || {}),
        form_title: updateFields.title,
      };
    }

    const updatedMapping = await prisma.koboFormMapping.update({
      where: { id: mapping.id },
      data: {
        mapping: nextDefinition,
        lastValidated: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'ged-os-toolbox-admin',
        action: 'TOOLBOX_XLSFORM_UPDATE',
        details: { formKey, updatedFields: Object.keys(updateFields) },
      },
    });

    return res.json({
      success: true,
      form: summarizeUniversalXlsFormMapping(updatedMapping),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition update error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Erreur serveur lors de la mise à jour du formulaire' });
  }
};

export const deleteToolboxFormDefinition = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const formKey = String(req.params.formKey || '').trim();

    if (!formKey) {
      return res.status(400).json({
        success: false,
        message: 'formKey is required',
      });
    }

    const mapping = await prisma.koboFormMapping.findFirst({
      where: {
        organizationId,
        koboAssetId: formKey,
      },
    });

    if (!mapping || !isPlainObject(mapping.mapping) || isUniversalXlsFormDeleted(mapping.mapping)) {
      return res.status(404).json({
        success: false,
        message: 'XLSForm definition not found',
      });
    }

    const now = new Date().toISOString();
    const nextDefinition = {
      ...mapping.mapping,
      lifecycle: {
        ...(mapping.mapping.lifecycle || {}),
        active: false,
        status: 'deleted',
        deletedAt: now,
        deletedById: userId,
      },
    };

    const updatedMapping = await prisma.koboFormMapping.update({
      where: { id: mapping.id },
      data: {
        mapping: nextDefinition,
        lastValidated: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'ged-os-toolbox-admin',
        action: 'TOOLBOX_XLSFORM_DELETE',
        details: {
          formKey,
          title: mapping.mapping.title || formKey,
          deletedAt: now,
        },
      },
    });

    return res.json({
      success: true,
      form: summarizeUniversalXlsFormMapping(updatedMapping),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition delete error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting XLSForm definition',
    });
  }
};

export const compareToolboxFormDefinitions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const formKey = String(req.params.formKey || '').trim();
    const targetFormKey = String(req.params.targetFormKey || '').trim();
    const [previousMapping, currentMapping] = await Promise.all([
      findUniversalXlsFormDefinition(organizationId, formKey),
      findUniversalXlsFormDefinition(organizationId, targetFormKey),
    ]);

    if (!previousMapping || !currentMapping) {
      return res.status(404).json({
        success: false,
        message: 'One of the XLSForm definitions was not found',
      });
    }

    return res.json({
      success: true,
      comparison: compareXlsFormDefinitions(previousMapping.definition, currentMapping.definition),
    });
  } catch (err) {
    logger.error('[TOOLBOX] form-definition compare error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while comparing XLSForm definitions',
    });
  }
};

function getBuilderBaseChoices() {
  return [
    { list_name: 'roles', name: 'livreur', label: 'Livreur' },
    { list_name: 'roles', name: 'macon', label: 'Macon' },
    { list_name: 'roles', name: 'reseau', label: 'Equipe reseau' },
    { list_name: 'roles', name: 'interieur', label: 'Equipe installateur' },
    { list_name: 'roles', name: 'controleur', label: 'Controleur' },
    { list_name: 'roles', name: '__pr_parateur', label: 'Preparateur' },
    { list_name: 'oui_non', name: 'oui', label: 'Oui' },
    { list_name: 'oui_non', name: 'non', label: 'Non' },
  ];
}

function buildDefaultBuilderSurvey() {
  return [
    { type: 'start', name: 'start' },
    { type: 'end', name: 'end' },
    { type: 'begin_group', name: 'TYPE_DE_VISITE', label: 'Menage' },
    { type: 'integer', name: 'Numero_ordre', label: 'Numero ordre', required: 'yes' },
    {
      type: 'text',
      name: 'nom_key',
      label: 'Prenom et Nom',
      calculation: "pulldata('Thies','nom','code_key',${Numero_ordre})",
      required: 'yes',
    },
    {
      type: 'text',
      name: 'telephone_key',
      label: 'Telephone',
      calculation: "pulldata('Thies','telephone','code_key',${Numero_ordre})",
    },
    {
      type: 'text',
      name: 'latitude_key',
      label: 'Latitude',
      calculation: "pulldata('Thies','latitude','code_key',${Numero_ordre})",
    },
    {
      type: 'text',
      name: 'longitude_key',
      label: 'Longitude',
      calculation: "pulldata('Thies','longitude','code_key',${Numero_ordre})",
    },
    {
      type: 'text',
      name: 'region_key',
      label: 'Region',
      calculation: "pulldata('Thies','region','code_key',${Numero_ordre})",
    },
    {
      type: 'geopoint',
      name: 'LOCALISATION_CLIENT',
      label: 'Coordonnees GPS du menage',
      calculation: "concat(${latitude_key}, ' ', ${longitude_key})",
    },
    { type: 'select_one roles', name: 'role', label: 'Votre role', required: 'yes' },
    { type: 'end_group', name: 'TYPE_DE_VISITE_end' },
    { type: 'begin_group', name: 'notes_generales_group', label: 'Notes generales' },
    { type: 'text', name: 'notes_generales', label: 'Notes generales', required: 'yes' },
    { type: 'end_group', name: 'notes_generales_group_end' },
  ];
}

function normalizeBuilderSurveyRows(rawSurvey) {
  if (!Array.isArray(rawSurvey) || rawSurvey.length === 0) return buildDefaultBuilderSurvey();
  return rawSurvey
    .filter((row) => isPlainObject(row))
    .map((row, index) => {
      const type = String(row.type || 'text').trim() || 'text';
      const name = normalizeBuilderKey(
        row.name || row.label || `question_${index + 1}`,
        `question_${index + 1}`
      );
      const normalized = {
        type,
        name,
        label: String(row.label || name).trim(),
        hint: String(row.hint || '').trim(),
        required: row.required === true || row.required === 'yes' ? 'yes' : row.required || '',
        relevant: String(row.relevant || '').trim(),
        constraint: String(row.constraint || '').trim(),
        constraint_message: String(row.constraintMessage || row.constraint_message || '').trim(),
        calculation: String(row.calculation || '').trim(),
        default: String(row.default || row.defaultValue || '').trim(),
        readonly:
          row.readonly === true ||
          row.readOnly === true ||
          row.readonly === 'yes' ||
          row.readOnly === 'yes'
            ? 'yes'
            : String(row.readonly || row.readOnly || '').trim(),
        appearance: String(row.appearance || '').trim(),
        parameters: String(row.parameters || '').trim(),
        choice_filter: String(row.choiceFilter || row.choice_filter || '').trim(),
      };
      Object.entries(row).forEach(([key, value]) => {
        if (/^(label|hint|constraint_message|media::image)::/i.test(key)) {
          normalized[key] = String(value || '').trim();
        }
      });
      return normalized;
    });
}

function normalizeBuilderChoices(rawChoices) {
  const choices = [...getBuilderBaseChoices()];
  if (!Array.isArray(rawChoices)) return choices;
  rawChoices
    .filter((choice) => isPlainObject(choice))
    .forEach((choice) => {
      const listName = String(choice.list_name || choice.listName || '').trim();
      const name = normalizeBuilderKey(choice.name || choice.label, 'choice');
      if (!listName || !name) return;
      choices.push({
        list_name: listName,
        name,
        label: String(choice.label || name).trim(),
      });
      Object.entries(choice).forEach(([key, value]) => {
        if (/^(label|media::image)::/i.test(key)) {
          choices[choices.length - 1][key] = String(value || '').trim();
        }
      });
    });
  return choices;
}

function buildDefinitionPayload({
  parsedDefinition,
  existingDefinition,
  importId,
  userId,
  sourceHash,
  sourcePatch = {},
  lifecycleStatus = 'active',
}) {
  const previousComparison = existingDefinition
    ? compareXlsFormDefinitions(existingDefinition, parsedDefinition)
    : null;
  const importHistoryEntry = buildImportHistoryEntry({
    definition: parsedDefinition,
    importId,
    userId,
    fileName: sourcePatch.fileName || parsedDefinition.source?.fileName || 'builder.json',
    storageKey:
      sourcePatch.definitionStorageKey || parsedDefinition.source?.definitionStorageKey || '',
    sourceHash,
  });

  return {
    definition: {
      ...parsedDefinition,
      lifecycle: {
        active: lifecycleStatus !== 'draft' && lifecycleStatus !== 'inactive',
        status: lifecycleStatus,
        importedAt: parsedDefinition.importedAt,
        importedById: userId,
        activatedAt: lifecycleStatus === 'active' ? new Date().toISOString() : null,
        activatedById: lifecycleStatus === 'active' ? userId : null,
        previousVersion: null,
      },
      source: {
        ...(parsedDefinition.source || {}),
        ...sourcePatch,
        sourceHash,
      },
      importHistory: mergeImportHistory(existingDefinition, importHistoryEntry),
      previousDefinitionSummary: existingDefinition
        ? buildDefinitionSummary(existingDefinition)
        : null,
      previousComparisonSummary: previousComparison?.summary || null,
    },
    previousComparison,
  };
}

export const createToolboxFormDefinition = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'Project title is required' });
    }

    const importId = crypto.randomUUID();
    const formKey = normalizeBuilderKey(req.body?.formKey || title, 'ged_os_form');
    const formVersion = String(
      req.body?.formVersion || `draft-${new Date().toISOString().replace(/[:.]/g, '-')}`
    ).trim();
    const settings = {
      ...(isPlainObject(req.body?.settings) ? req.body.settings : {}),
      form_title: title,
      form_id: formKey,
      version: formVersion,
      default_language: req.body?.defaultLanguage || 'Francais (fr)',
      style: req.body?.style || 'pages',
    };
    const survey = normalizeBuilderSurveyRows(req.body?.survey);
    const choices = normalizeBuilderChoices(req.body?.choices);
    const sourceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ settings, survey, choices }))
      .digest('hex');
    const baseKey = `${organizationId}/toolbox/forms/${importId}`;
    const parsedDefinition = buildXlsFormDefinition({
      survey,
      choices,
      settings,
      source: {
        sourceType: req.body?.sourceType || 'builder',
        description: req.body?.description || '',
        sector: req.body?.sector || '',
        country: req.body?.country || '',
        fileName: `${formKey}.json`,
        storageKey: `${baseKey}.json`,
        definitionStorageKey: `${baseKey}.json`,
      },
    });

    const existingMapping = await prisma.koboFormMapping.findFirst({
      where: {
        organizationId,
        koboAssetId: parsedDefinition.formKey,
      },
    });
    const existingDefinition = isPlainObject(existingMapping?.mapping)
      ? existingMapping.mapping
      : null;
    const { definition: nextDefinition, previousComparison } = buildDefinitionPayload({
      parsedDefinition,
      existingDefinition,
      importId,
      userId,
      sourceHash,
      sourcePatch: {
        sourceType: req.body?.sourceType || 'builder',
        fileName: `${formKey}.json`,
        storageKey: `${baseKey}.json`,
        definitionStorageKey: `${baseKey}.json`,
      },
      lifecycleStatus: req.body?.activate ? 'active' : 'draft',
    });

    await uploadFile(
      `${baseKey}.json`,
      Buffer.from(JSON.stringify(nextDefinition, null, 2), 'utf8'),
      'application/json'
    );

    let storedMapping;
    if (existingMapping) {
      storedMapping = await prisma.koboFormMapping.update({
        where: { id: existingMapping.id },
        data: {
          version: nextDefinition.formVersion,
          mapping: nextDefinition,
          lastValidated: new Date(),
        },
      });
    } else {
      storedMapping = await prisma.koboFormMapping.create({
        data: {
          organizationId,
          koboAssetId: nextDefinition.formKey,
          version: nextDefinition.formVersion,
          mapping: nextDefinition,
        },
      });
    }

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'gem-toolbox-admin',
        action: 'TOOLBOX_FORM_BUILDER_SAVE',
        details: {
          importId,
          formKey: nextDefinition.formKey,
          formVersion: nextDefinition.formVersion,
          lifecycleStatus: nextDefinition.lifecycle.status,
          diagnostics: nextDefinition.diagnostics,
          sourceHash,
          previousComparisonSummary: previousComparison?.summary || null,
        },
      },
    });

    return res.status(201).json({
      success: true,
      importId,
      storageKey: `${baseKey}.json`,
      comparison: previousComparison,
      form: summarizeUniversalXlsFormMapping(storedMapping),
    });
  } catch (err) {
    logger.error(
      '[TOOLBOX] form builder create error:',
      err?.message || err,
      err?.stack || 'no-stack'
    );
    return res.status(500).json({
      success: false,
      message: 'Server error while creating internal Kobo form',
    });
  }
};

export const importToolboxXlsFormFromUrl = async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ success: false, message: 'A valid XLSForm URL is required' });
    }

    const response = await fetch(url, {
      headers: {
        accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
      },
    });
    if (!response.ok) {
      return res
        .status(400)
        .json({ success: false, message: `Unable to download XLSForm URL (${response.status})` });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_XLSFORM_REMOTE_BYTES) {
      return res.status(413).json({ success: false, message: 'Remote XLSForm is too large' });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_XLSFORM_REMOTE_BYTES) {
      return res.status(413).json({ success: false, message: 'Remote XLSForm is too large' });
    }

    req.file = {
      buffer: Buffer.from(arrayBuffer),
      originalname: url.split('/').pop()?.split('?')[0] || 'remote-xlsform.xlsx',
      mimetype:
        response.headers.get('content-type') ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    req.body = { ...req.body, sourceUrl: url };
    return importToolboxXlsForm(req, res);
  } catch (err) {
    logger.error(
      '[TOOLBOX] XLSForm URL import error:',
      err?.message || err,
      err?.stack || 'no-stack'
    );
    return res.status(500).json({
      success: false,
      message: 'Server error while importing XLSForm URL',
    });
  }
};

export const importToolboxXlsForm = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'XLSForm file is required' });
    }

    const { organizationId, id: userId } = req.user;
    const importId = crypto.randomUUID();
    const baseKey = `${organizationId}/toolbox/forms/${importId}`;
    const sourceHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const parsedDefinition = await parseXlsFormBuffer(req.file.buffer, {
      fileName: req.file.originalname,
      mimeType:
        req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sourceHash,
      storageKey: `${baseKey}.xlsx`,
    });
    const existingMapping = await prisma.koboFormMapping.findFirst({
      where: {
        organizationId,
        koboAssetId: parsedDefinition.formKey,
      },
    });
    const existingDefinition = isPlainObject(existingMapping?.mapping)
      ? existingMapping.mapping
      : null;
    const importHistoryEntry = buildImportHistoryEntry({
      definition: parsedDefinition,
      importId,
      userId,
      fileName: req.file.originalname,
      storageKey: `${baseKey}.json`,
      sourceHash,
    });
    const previousComparison = existingDefinition
      ? compareXlsFormDefinitions(existingDefinition, parsedDefinition)
      : null;
    const importedDefinition = {
      ...parsedDefinition,
      lifecycle: {
        active: true,
        status: 'active',
        importedAt: parsedDefinition.importedAt,
        importedById: userId,
        activatedAt: new Date().toISOString(),
        activatedById: userId,
        previousVersion: existingMapping?.version || null,
      },
      source: {
        ...(parsedDefinition.source || {}),
        sourceHash,
        storageKey: `${baseKey}.xlsx`,
        definitionStorageKey: `${baseKey}.json`,
      },
      importHistory: mergeImportHistory(existingDefinition, importHistoryEntry),
      previousDefinitionSummary: existingDefinition
        ? buildDefinitionSummary(existingDefinition)
        : null,
      previousComparisonSummary: previousComparison?.summary || null,
    };

    await uploadFile(
      `${baseKey}.xlsx`,
      req.file.buffer,
      req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    await uploadFile(
      `${baseKey}.json`,
      Buffer.from(JSON.stringify(importedDefinition, null, 2), 'utf8'),
      'application/json'
    );

    let storedMapping;
    if (existingMapping) {
      storedMapping = await prisma.koboFormMapping.update({
        where: { id: existingMapping.id },
        data: {
          version: importedDefinition.formVersion,
          mapping: importedDefinition,
          lastValidated: new Date(),
        },
      });
    } else {
      storedMapping = await prisma.koboFormMapping.create({
        data: {
          organizationId,
          koboAssetId: parsedDefinition.formKey,
          version: importedDefinition.formVersion,
          mapping: importedDefinition,
        },
      });
    }

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'gem-toolbox-admin',
        action: 'TOOLBOX_XLSFORM_IMPORT',
        details: {
          importId,
          fileName: req.file.originalname,
          formKey: importedDefinition.formKey,
          formVersion: importedDefinition.formVersion,
          diagnostics: importedDefinition.diagnostics,
          engine: importedDefinition.engine,
          engineVersion: importedDefinition.engineVersion,
          capabilities: importedDefinition.capabilities,
          sourceHash,
          previousComparisonSummary: previousComparison?.summary || null,
        },
      },
    });

    return res.status(201).json({
      success: true,
      importId,
      storageKey: `${baseKey}.json`,
      comparison: previousComparison,
      form: summarizeUniversalXlsFormMapping(storedMapping),
    });
  } catch (err) {
    logger.error('[TOOLBOX] XLSForm import error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while importing XLSForm',
    });
  }
};

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || '';

function buildSubmissionWhere(user, query = {}) {
  const { organizationId, id: userId, role: rawUserRole } = user;
  const userRole = (rawUserRole || '').toUpperCase();

  const {
    householdId,
    numeroOrdre,
    status,
    syncStatus,
    role,
    formKey,
    submittedById,
    agent,
    clientSubmissionId,
    q,
    from,
    to,
    mobileOnly,
  } = query;
  const numeroVariants = normalizeNumeroVariants(numeroOrdre);
  const filters = [{ organizationId }];

  // --- ISOLATION STRICTE DES DONNÉES ---
  // Chaque utilisateur ne voit que ses propres soumissions, sauf s'il est administrateur ou validateur
  if (
    !['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole) &&
    user.email !== SUPER_ADMIN_EMAIL
  ) {
    filters.push({ submittedById: userId });
  }

  if (householdId) filters.push({ householdId: String(householdId) });
  if (numeroVariants.length > 0) {
    filters.push({
      OR: numeroVariants.map((value) => ({ numeroOrdre: { equals: value, mode: 'insensitive' } })),
    });
  }
  if (status) filters.push({ status: String(status) });
  if (syncStatus) filters.push({ syncStatus: String(syncStatus) });
  if (role) filters.push({ role: String(role) });
  if (formKey) filters.push({ formKey: String(formKey) });
  if (submittedById) filters.push({ submittedById: String(submittedById) });
  if (mobileOnly === 'true') {
    filters.push({ submittedBy: { is: { phoneActivated: true } } });
  }
  if (agent) {
    const agentSearch = String(agent).trim();
    if (agentSearch) {
      filters.push({
        submittedBy: {
          is: {
            OR: [
              { name: { contains: agentSearch, mode: 'insensitive' } },
              { email: { contains: agentSearch, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
  }
  if (clientSubmissionId) filters.push({ clientSubmissionId: String(clientSubmissionId) });

  const savedAtFilter = {};
  if (from) {
    const fromDate = new Date(String(from));
    if (!Number.isNaN(fromDate.getTime())) savedAtFilter.gte = fromDate;
  }
  if (to) {
    const toDate = new Date(String(to));
    if (!Number.isNaN(toDate.getTime())) savedAtFilter.lte = toDate;
  }
  if (Object.keys(savedAtFilter).length > 0) filters.push({ savedAt: savedAtFilter });

  const search = String(q || '').trim();
  if (search) {
    filters.push({
      OR: [
        { clientSubmissionId: { contains: search, mode: 'insensitive' } },
        { numeroOrdre: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } },
        {
          household: {
            is: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { village: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

function toolboxSubmissionInclude() {
  return {
    household: {
      select: {
        id: true,
        numeroordre: true,
        name: true,
        phone: true,
        status: true,
        region: true,
        village: true,
        updatedAt: true,
      },
    },
    submittedBy: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  };
}

function extractGeopointFromValues(values) {
  const candidates = [
    values.LOCALISATION_CLIENT,
    values.gps,
    values.geopoint,
    values._geolocation,
  ].filter(Boolean);
  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const parts = raw.trim().split(/\s+/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
  }
  const lat = values.latitude_key ?? values.latitude ?? values.lat;
  const lng = values.longitude_key ?? values.longitude ?? values.lon ?? values.lng;
  if (lat != null && lng != null) {
    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!isNaN(nlat) && !isNaN(nlng)) return { lat: nlat, lng: nlng };
  }
  return null;
}

export const exportToolboxSubmissions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const format = String(req.query.format || 'csv').toLowerCase();
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 5000);
    const columns = req.query.columns
      ? String(req.query.columns)
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : null;
    const where = buildSubmissionWhere(req.user, req.query);
    const submissions = await prisma.toolboxSubmission.findMany({
      where,
      include: toolboxSubmissionInclude(),
      orderBy: { savedAt: 'desc' },
      take,
    });

    const valueKeys = Array.from(
      new Set(
        submissions.flatMap((submission) =>
          Object.keys(isPlainObject(submission.values) ? submission.values : {}).filter(
            (key) => !key.startsWith('_ged_os_attachment_')
          )
        )
      )
    ).sort();
    const rows = submissions.map((submission) =>
      flattenSubmissionForExport(submission, valueKeys, columns)
    );
    const generatedAt = new Date().toISOString();
    const baseFilename = `soumissions-kobo-interne-${generatedAt.slice(0, 10)}`;

    if (format === 'kml') {
      const placemarks = submissions
        .map((s) => {
          const coords = extractGeopointFromValues(s.values || {});
          if (!coords) return null;
          const props = flattenSubmissionForExport(s, valueKeys);
          const description = Object.entries(props)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(
              ([k, v]) =>
                `${k}: ${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`
            )
            .join('\n');
          const name = props.numeroOrdre || props.householdName || `Soumission ${s.id.slice(0, 8)}`;
          return `      <Placemark>\n        <name>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</name>\n        <description><![CDATA[${description}]]></description>\n        <Point><coordinates>${coords.lng},${coords.lat},0</coordinates></Point>\n      </Placemark>`;
        })
        .filter(Boolean)
        .join('\n');

      const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Soumissions ${generatedAt.slice(0, 10)}</name>\n${placemarks}\n  </Document>\n</kml>`;
      res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.kml"`);
      return res.send(kml);
    }

    if (format === 'geojson') {
      const features = submissions
        .map((s) => {
          const coords = extractGeopointFromValues(s.values || {});
          if (!coords) return null;
          const props = flattenSubmissionForExport(s, valueKeys);
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
            properties: { ...props, submission_id: s.id, form_key: s.formKey },
          };
        })
        .filter(Boolean);
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.geojson"`);
      return res.send(
        JSON.stringify(
          { type: 'FeatureCollection', generatedAt, count: features.length, features },
          null,
          2
        )
      );
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.json"`);
      return res.send(
        JSON.stringify(
          {
            generatedAt,
            count: submissions.length,
            submissions: sanitizeBigIntForJson(submissions),
          },
          null,
          2
        )
      );
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('soumissions');
      const headers = Object.keys(rows[0] || flattenSubmissionForExport({}, valueKeys));
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.min(Math.max(header.length + 4, 14), 42),
      }));
      rows.forEach((row) => worksheet.addRow(row));
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    const headers = Object.keys(rows[0] || flattenSubmissionForExport({}, valueKeys));
    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
    return res.send(csv);
  } catch (err) {
    logger.error('[TOOLBOX] export error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while exporting internal Kobo submissions',
    });
  }
};

export const deleteToolboxSubmission = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { id } = req.params;

    const submission = await prisma.toolboxSubmission.findFirst({
      where: { id, organizationId },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Soumission introuvable.',
      });
    }

    await prisma.toolboxSubmission.delete({ where: { id } });

    await tracerAction({
      userId,
      organizationId,
      action: 'SUPPRESSION_KOBO_INTERNE',
      resource: 'ToolboxSubmission',
      resourceId: id,
      details: {
        clientSubmissionId: submission.clientSubmissionId,
        formKey: submission.formKey,
        status: submission.status,
      },
    }).catch((err) => {
      logger.warn('[Toolbox] Audit delete failed:', err?.message || err);
    });

    return res.json({ success: true, message: 'Soumission supprimée.' });
  } catch (err) {
    logger.error('[Toolbox] Delete submission error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la suppression.' });
  }
};

export const reviewToolboxSubmission = async (req, res) => {
  try {
    const { organizationId, id: userId, role: rawUserRole } = req.user;
    const userRole = (rawUserRole || '').toUpperCase();
    const { id } = req.params;
    const nextStatus = String(req.body.status || '')
      .trim()
      .toLowerCase();
    const note = String(req.body.note || '').trim();

    if (!REVIEW_STATUSES.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Review status must be submitted, validated or rejected',
      });
    }

    const current = await prisma.toolboxSubmission.findFirst({
      where: {
        id,
        organizationId,
        // Restriction d'appartenance pour les non-admins
        ...(!['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole) &&
        req.user.email !== SUPER_ADMIN_EMAIL
          ? { submittedById: userId }
          : {}),
      },
    });
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: 'Internal Kobo submission not found' });
    }

    const currentMetadata = isPlainObject(current.metadata) ? current.metadata : {};
    const currentValidationIssues = Array.isArray(currentMetadata.serverValidationIssues)
      ? currentMetadata.serverValidationIssues
      : [];
    const hasBlockingIssues =
      (current.requiredMissing || []).length > 0 || currentValidationIssues.length > 0;

    if (nextStatus === 'validated' && hasBlockingIssues) {
      return res.status(422).json({
        success: false,
        message:
          'Internal Kobo submission cannot be validated while required or constraint issues remain',
        details: {
          requiredMissing: current.requiredMissing || [],
          validationIssues: currentValidationIssues,
        },
      });
    }

    const metadata = {
      ...currentMetadata,
      review: {
        status: nextStatus,
        note,
        reviewedById: userId,
        reviewedAt: new Date().toISOString(),
      },
    };

    const submission = await prisma.toolboxSubmission.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        metadata,
        syncStatus: 'synced',
        savedAt: new Date(),
      },
      include: toolboxSubmissionInclude(),
    });

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'gem-toolbox-admin',
        action: 'TOOLBOX_REVIEW',
        details: {
          submissionId: current.id,
          clientSubmissionId: current.clientSubmissionId,
          previousStatus: current.status,
          nextStatus,
          note,
          requiredMissing: current.requiredMissing || [],
          validationIssues: currentValidationIssues,
        },
      },
    });

    try {
      await tracerAction({
        userId,
        organizationId,
        action: 'REVUE_KOBO_INTERNE',
        resource: 'ToolboxSubmission',
        resourceId: submission.id,
        details: {
          clientSubmissionId: current.clientSubmissionId,
          previousStatus: current.status,
          nextStatus,
          note,
          requiredMissing: current.requiredMissing || [],
          validationIssues: currentValidationIssues,
        },
        req,
      });
    } catch (auditError) {
      logger.error('[TOOLBOX] review audit log error:', auditError.message);
    }

    return res.json({ success: true, submission: sanitizeBigIntForJson(submission) });
  } catch (err) {
    logger.error('[TOOLBOX] review error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while reviewing internal Kobo submission',
    });
  }
};

export const listToolboxSubmissions = async (req, res) => {
  try {
    const { limit = '100', offset = '0' } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const skip = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 100000);

    const where = buildSubmissionWhere(req.user, req.query);

    const [submissions, totalCount] = await Promise.all([
      prisma.toolboxSubmission.findMany({
        where,
        include: {
          household: {
            select: {
              id: true,
              numeroordre: true,
              name: true,
              phone: true,
              status: true,
              region: true,
              village: true,
              updatedAt: true,
            },
          },
          submittedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { savedAt: 'desc' },
        skip,
        take,
      }),
      prisma.toolboxSubmission.count({ where }),
    ]);

    const countBy = (key) =>
      submissions.reduce((acc, submission) => {
        const value = String(submission[key] || 'non_renseigne');
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});
    const filteredMediaStats = submissions.reduce(
      (acc, submission) => {
        const media = isPlainObject(submission.metadata?.media) ? submission.metadata.media : {};
        acc.attachmentCount += Number(media.attachmentCount || 0);
        acc.serverStoredCount += Number(media.serverStoredCount || 0);
        acc.unresolvedCount += Number(media.unresolvedCount || 0);
        acc.totalStoredBytes += Number(media.totalStoredBytes || 0);
        acc.duplicateHashCount += Number(media.duplicateHashCount || 0);
        return acc;
      },
      {
        attachmentCount: 0,
        serverStoredCount: 0,
        unresolvedCount: 0,
        totalStoredBytes: 0,
        duplicateHashCount: 0,
      }
    );

    const diagnostics = {
      scope: 'filtered',
      count: totalCount,
      pageCount: submissions.length,
      offset: skip,
      limit: take,
      byStatus: countBy('status'),
      byRole: countBy('role'),
      bySyncStatus: countBy('syncStatus'),
      byFormKey: countBy('formKey'),
      byFormVersion: countBy('formVersion'),
      missingRequiredCount: submissions.filter(
        (submission) => (submission.requiredMissing || []).length > 0
      ).length,
      validationIssueCount: submissions.filter(
        (submission) =>
          Array.isArray(submission.metadata?.serverValidationIssues) &&
          submission.metadata.serverValidationIssues.length > 0
      ).length,
      versionMismatchCount: submissions.filter(
        (submission) => submission.metadata?.formVersionMismatch === true
      ).length,
      mediaStats: filteredMediaStats,
      latestSavedAt: submissions[0]?.savedAt || null,
      serverFormVersion: TOOLBOX_FORM_VERSION,
      generatedAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      count: totalCount,
      pageCount: submissions.length,
      offset: skip,
      limit: take,
      diagnostics,
      submissions: sanitizeBigIntForJson(submissions),
    });
  } catch (err) {
    logger.error('[TOOLBOX] list error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching internal Kobo submissions',
    });
  }
};

export const getToolboxDiagnostics = async (req, res) => {
  try {
    const { organizationId } = req.user; // ← was missing — caused 500 on koboFormMapping queries
    const where = buildSubmissionWhere(req.user, req.query);

    const last24hDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, last24h, latestSubmissions, mappings, queueReports] = await Promise.all([
      prisma.toolboxSubmission.count({ where }),
      prisma.toolboxSubmission.count({
        where: { ...where, savedAt: { gte: last24hDate } },
      }),
      prisma.toolboxSubmission.findMany({
        where,
        orderBy: { savedAt: 'desc' },
        take: 1000,
        select: {
          id: true,
          numeroOrdre: true,
          role: true,
          status: true,
          syncStatus: true,
          formKey: true,
          formVersion: true,
          metadata: true,
          requiredMissing: true,
          savedAt: true,
          submittedAt: true,
          householdId: true,
        },
      }),
      prisma.koboFormMapping.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.syncLog.findMany({
        where: {
          organizationId,
          action: 'TOOLBOX_CLIENT_QUEUE_REPORT',
          timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
    ]);

    const countBy = (values, selector) =>
      values.reduce((acc, item) => {
        const value = String(selector(item) || 'non_renseigne');
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});

    const formSummaries = mappings.map(summarizeUniversalXlsFormMapping);
    const activeForms = formSummaries.filter((form) => form.active !== false);
    const inactiveForms = formSummaries.filter((form) => form.active === false);
    const activeVersionByFormKey = new Map(
      activeForms.map((form) => [form.formKey, form.formVersion])
    );
    const getExpectedFormVersion = (submission) => {
      if (activeVersionByFormKey.has(submission.formKey))
        return activeVersionByFormKey.get(submission.formKey);
      if (submission.formKey === TOOLBOX_FORM_KEY) return TOOLBOX_FORM_VERSION;
      return null;
    };
    const versionMismatchCount = latestSubmissions.filter((submission) => {
      if (submission.metadata?.formVersionMismatch === true) return true;
      const expectedVersion = getExpectedFormVersion(submission);
      return expectedVersion ? submission.formVersion !== expectedVersion : false;
    }).length;
    const missingRequiredCount = latestSubmissions.filter(
      (submission) => (submission.requiredMissing || []).length > 0
    ).length;
    const validationIssueCount = latestSubmissions.filter(
      (submission) =>
        Array.isArray(submission.metadata?.serverValidationIssues) &&
        submission.metadata.serverValidationIssues.length > 0
    ).length;
    const unresolvedHouseholdCount = latestSubmissions.filter(
      (submission) => !submission.householdId
    ).length;
    const mediaStats = latestSubmissions.reduce(
      (acc, submission) => {
        const media = isPlainObject(submission.metadata?.media) ? submission.metadata.media : {};
        acc.attachmentCount += Number(media.attachmentCount || 0);
        acc.serverStoredCount += Number(media.serverStoredCount || 0);
        acc.unresolvedCount += Number(media.unresolvedCount || 0);
        acc.totalStoredBytes += Number(media.totalStoredBytes || 0);
        acc.duplicateHashCount += Number(media.duplicateHashCount || 0);
        return acc;
      },
      {
        attachmentCount: 0,
        serverStoredCount: 0,
        unresolvedCount: 0,
        totalStoredBytes: 0,
        duplicateHashCount: 0,
      }
    );
    const latestQueueReports = queueReports.map((report) => ({
      id: report.id,
      timestamp: report.timestamp,
      pending: Number(report.details?.pending || 0),
      failed: Number(report.details?.failed || 0),
      blocked: Number(report.details?.blocked || 0),
      mediaBytes: Number(report.details?.mediaBytes || 0),
      device: report.details?.device || {},
      queueSample: Array.isArray(report.details?.queue) ? report.details.queue.slice(0, 10) : [],
    }));
    const latestQueueReport = latestQueueReports[0] || null;
    const warningMessages = [];

    if (versionMismatchCount > 0) {
      warningMessages.push(
        `${versionMismatchCount} soumission(s) avec une version XLSForm differente du serveur`
      );
    }
    if (missingRequiredCount > 0) {
      warningMessages.push(
        `${missingRequiredCount} brouillon(s) ou fiche(s) avec champs requis manquants`
      );
    }
    if (validationIssueCount > 0) {
      warningMessages.push(
        `${validationIssueCount} soumission(s) avec correction de valeur a traiter`
      );
    }
    if (unresolvedHouseholdCount > 0) {
      warningMessages.push(
        `${unresolvedHouseholdCount} soumission(s) non rattachee(s) a un menage serveur`
      );
    }
    if (mediaStats.unresolvedCount > 0) {
      warningMessages.push(
        `${mediaStats.unresolvedCount} piece(s) jointe(s) non resolue(s) dans les soumissions recentes`
      );
    }
    if (latestQueueReport && (latestQueueReport.failed > 0 || latestQueueReport.blocked > 0)) {
      warningMessages.push(
        `File terrain signalee: ${latestQueueReport.failed} echec(s), ${latestQueueReport.blocked} bloque(s)`
      );
    }

    const health =
      unresolvedHouseholdCount > 0 ||
      versionMismatchCount > 0 ||
      validationIssueCount > 0 ||
      mediaStats.unresolvedCount > 0
        ? 'warning'
        : latestSubmissions.some((submission) => submission.syncStatus !== 'synced')
          ? 'warning'
          : 'ok';

    return res.json({
      success: true,
      diagnostics: sanitizeBigIntForJson({
        scope: 'organization',
        health,
        total,
        receivedLast24h: last24h,
        sampleSize: latestSubmissions.length,
        byStatus: countBy(latestSubmissions, (submission) => submission.status),
        byRole: countBy(latestSubmissions, (submission) => submission.role),
        bySyncStatus: countBy(latestSubmissions, (submission) => submission.syncStatus),
        byFormKey: countBy(latestSubmissions, (submission) => submission.formKey),
        byFormVersion: countBy(latestSubmissions, (submission) => submission.formVersion),
        versionMismatchCount,
        missingRequiredCount,
        validationIssueCount,
        unresolvedHouseholdCount,
        activeFormCount: activeForms.length,
        inactiveFormCount: inactiveForms.length,
        activeForms,
        inactiveForms,
        serverFormVersions: Object.fromEntries(activeVersionByFormKey),
        mediaStats,
        clientQueue: {
          latestReportedAt: latestQueueReport?.timestamp || null,
          pending: latestQueueReport?.pending || 0,
          failed: latestQueueReport?.failed || 0,
          blocked: latestQueueReport?.blocked || 0,
          mediaBytes: latestQueueReport?.mediaBytes || 0,
          devices: latestQueueReports,
        },
        latestSavedAt: latestSubmissions[0]?.savedAt || null,
        serverFormVersion:
          activeVersionByFormKey.get(TOOLBOX_FORM_KEY) ||
          activeForms[0]?.formVersion ||
          TOOLBOX_FORM_VERSION,
        warnings: warningMessages,
        generatedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logger.error('[TOOLBOX] diagnostics error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching internal Kobo diagnostics',
    });
  }
};

export const getToolboxSubmission = async (req, res) => {
  try {
    const { organizationId, id: userId, role: rawUserRole } = req.user;
    const userRole = (rawUserRole || '').toUpperCase();
    const { id } = req.params;

    const submission = await prisma.toolboxSubmission.findFirst({
      where: {
        id,
        organizationId,
        // Restriction d'appartenance pour les non-admins
        ...(!['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole) &&
        req.user.email !== SUPER_ADMIN_EMAIL
          ? { submittedById: userId }
          : {}),
      },
      include: {
        household: {
          select: {
            id: true,
            numeroordre: true,
            name: true,
            phone: true,
            status: true,
            region: true,
            village: true,
            updatedAt: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Internal Kobo submission not found',
      });
    }

    return res.json({
      success: true,
      submission: sanitizeBigIntForJson(submission),
    });
  } catch (err) {
    logger.error('[TOOLBOX] get error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching internal Kobo submission',
    });
  }
};

export const exportToolboxMedia = async (req, res) => {
  const { organizationId } = req.user;
  const { formKey, status } = req.query;

  try {
    const submissions = await prisma.toolboxSubmission.findMany({
      where: {
        organizationId,
        ...(formKey ? { formKey } : {}),
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        numeroOrdre: true,
        household: {
          select: { name: true, numeroordre: true },
        },
        metadata: true,
      },
    });

    const archive = archiver('zip', {
      zlib: { level: 5 },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ged-os-media-${formKey || 'all'}-${timestamp}.zip`;

    res.attachment(filename);
    archive.pipe(res);

    for (const submission of submissions) {
      const attachments = submission.metadata?.media?.attachments || [];
      if (!Array.isArray(attachments)) continue;

      const folderName = submission.household?.name
        ? `${submission.household.name}_${submission.id.slice(0, 8)}`
        : `Menage_${submission.numeroOrdre || 'Inconnu'}_${submission.id.slice(0, 8)}`;

      for (const attachment of attachments) {
        if (!attachment.key || attachment.status === 'unresolved') continue;

        const stream = await getFileStream(attachment.key);
        if (stream) {
          const ext = attachment.fileName?.split('.').pop() || 'jpg';
          const name = attachment.fieldName || 'media';
          archive.append(stream, { name: `${folderName}/${name}.${ext}` });
        }
      }
    }

    await archive.finalize();
  } catch (err) {
    logger.error('[TOOLBOX] Media export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Erreur lors de la génération du ZIP' });
    }
  }
};

export const getToolboxFormStats = async (req, res) => {
  try {
    const { formKey } = req.query;
    const { organizationId } = req.user;
    if (!formKey) return res.status(400).json({ success: false, message: 'formKey requis' });

    const baseWhere = { organizationId, formKey: String(formKey) };
    const now = new Date();
    const periods = {
      last7d: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      last31d: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      last3m: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      last12m: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };

    const [
      total,
      last7d,
      last31d,
      last3m,
      last12m,
      statusBreakdown,
      roleBreakdown,
      topSubmitters,
      weeklyTrend,
    ] = await Promise.all([
      prisma.toolboxSubmission.count({ where: baseWhere }),
      prisma.toolboxSubmission.count({ where: { ...baseWhere, savedAt: { gte: periods.last7d } } }),
      prisma.toolboxSubmission.count({
        where: { ...baseWhere, savedAt: { gte: periods.last31d } },
      }),
      prisma.toolboxSubmission.count({ where: { ...baseWhere, savedAt: { gte: periods.last3m } } }),
      prisma.toolboxSubmission.count({
        where: { ...baseWhere, savedAt: { gte: periods.last12m } },
      }),
      prisma.toolboxSubmission.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.toolboxSubmission.groupBy({
        by: ['role'],
        where: { ...baseWhere, role: { not: null } },
        _count: { id: true },
      }),
      prisma.toolboxSubmission.groupBy({
        by: ['submittedById'],
        where: { ...baseWhere, submittedById: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * i - 6);
          const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * i + 1);
          return prisma.toolboxSubmission.count({
            where: { ...baseWhere, savedAt: { gte: weekStart, lt: weekEnd } },
          });
        })
      ),
    ]);

    const last7dDays = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
        return prisma.toolboxSubmission.count({
          where: { ...baseWhere, savedAt: { gte: dayStart, lt: dayEnd } },
        });
      })
    );

    const submittersWithNames = await Promise.all(
      topSubmitters.map(async (s) => {
        let name = `Utilisateur ${s.submittedById?.slice(0, 8)}`;
        if (s.submittedById) {
          const user = await prisma.user.findUnique({
            where: { id: s.submittedById },
            select: { name: true, email: true },
          });
          if (user) name = user.name || user.email || name;
        }
        return { userId: s.submittedById, name, count: s._count.id };
      })
    );

    return res.json({
      success: true,
      stats: {
        total,
        last7d,
        last31d,
        last3m,
        last12m,
        last7dDays: last7dDays.reverse(),
        statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count.id })),
        roleBreakdown: roleBreakdown.map((r) => ({ role: r.role, count: r._count.id })),
        topSubmitters: submittersWithNames,
        weeklyTrend: weeklyTrend.reverse(),
      },
    });
  } catch (err) {
    logger.error('[TOOLBOX] formStats error:', err);
    return res.status(500).json({ success: false, message: 'Erreur stats formulaire' });
  }
};

/**
 * Export PDF d'une soumission
 * GET /api/toolbox/submissions/:id/pdf
 */
export const exportToolboxSubmissionPdf = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const submissionId = req.params.id;

    const { generateSubmissionPdf } = await import('../../services/pdfExport.service.js');
    const pdfBuffer = await generateSubmissionPdf(submissionId, organizationId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="soumission-${submissionId.slice(0, 8)}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err.message === 'Submission not found') {
      return res.status(404).json({ success: false, message: 'Soumission introuvable' });
    }
    logger.error('[TOOLBOX] PDF export error:', err.message);
    return res.status(500).json({ success: false, message: "Erreur d'export PDF" });
  }
};

/**
 * Upload de média standalone (images, documents, etc.)
 * POST /api/toolbox/media/upload
 */
export const uploadToolboxMedia = async (req, res) => {
  const { organizationId } = req.user;
  const { formKey, fieldName, fileName, mimeType, dataUrl, originalBytes } = req.body;

  try {
    // Parse the dataUrl to extract buffer and verify mime type
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Format dataUrl invalide',
      });
    }

    const { buffer, mimeType: parsedMime } = parsed;

    // Generate unique storage key
    const mediaId = crypto.randomUUID();
    const storageKey = `${organizationId}/toolbox/media/${mediaId}/${fileName}`;

    // Upload file to storage
    await uploadFile(storageKey, buffer, parsedMime || mimeType);

    // Generate URL for the uploaded file
    const url = `${process.env.MEDIA_BASE_URL || 'https://media.ged-os.com'}/${storageKey}`;

    // Log the upload
    await prisma.syncLog.create({
      data: {
        userId: req.user.id,
        organizationId,
        deviceId: 'gem-toolbox-admin',
        action: 'TOOLBOX_MEDIA_UPLOAD',
        details: {
          formKey,
          fieldName,
          fileName,
          mimeType: parsedMime || mimeType,
          storageKey,
          originalBytes: originalBytes || buffer.length,
        },
      },
    });

    return res.status(201).json({
      success: true,
      url,
      storageKey,
      fileName,
      mimeType: parsedMime || mimeType,
    });
  } catch (err) {
    logger.error('[TOOLBOX] Media upload error:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'upload du média",
    });
  }
};

/**
 * Liste les templates de formulaires pré-faits
 * GET /api/toolbox/form-templates
 */
export const listToolboxFormTemplates = async (req, res) => {
  try {
    const { FORM_TEMPLATES, getTemplatesBySector } = await import('./form-templates/index.js');
    const sector = req.query.sector;
    let templates = sector ? getTemplatesBySector(sector) : FORM_TEMPLATES;
    const total = templates.length;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    templates = templates.slice(offset, offset + limit);

    return res.json({
      success: true,
      count: templates.length,
      total,
      offset,
      limit,
      templates: templates.map((t) => ({
        key: t.key,
        title: t.title,
        description: t.description,
        sector: t.sector,
        country: t.country,
        languages: t.languages,
        fieldCount: t.survey.filter(
          (s) => !s.type.startsWith('begin_') && !s.type.startsWith('end_')
        ).length,
      })),
    });
  } catch (err) {
    logger.error('[TOOLBOX] list templates error:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur chargement templates' });
  }
};

/**
 * Récupère un template complet par sa clé
 * GET /api/toolbox/form-templates/:key
 */
export const getToolboxFormTemplate = async (req, res) => {
  try {
    const { getTemplateByKey } = await import('./form-templates/index.js');
    const template = getTemplateByKey(req.params.key);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template introuvable' });
    }
    return res.json({ success: true, template });
  } catch (err) {
    logger.error('[TOOLBOX] get template error:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur chargement template' });
  }
};

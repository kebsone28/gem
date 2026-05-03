import prisma from '../../core/utils/prisma.js';
import eventBus from '../../core/utils/eventBus.js';
import { tracerAction } from '../../services/audit.service.js';
import { uploadFile, getFileUrl } from '../../services/storage.service.js';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import {
    getServerRequiredMissing,
    getServerValidationIssues,
    INTERNAL_KOBO_ALLOWED_ROLES,
    INTERNAL_KOBO_FORM_KEY,
    INTERNAL_KOBO_FORM_VERSION
} from './internalKobo.validation.js';
import {
    parseXlsFormBuffer,
    validateXlsFormValues,
    XLSFORM_ENGINE_VERSION
} from './xlsFormEngine.js';

const SUBMISSION_STATUSES = new Set(['draft', 'submitted', 'validated', 'rejected']);
const REVIEW_STATUSES = new Set(['submitted', 'validated', 'rejected']);
const MAX_EMBEDDED_ATTACHMENT_BYTES = 8 * 1024 * 1024;
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

    return Array.from(new Set([
        normalized,
        normalized.replace(/^0+/, '') || normalized
    ]));
}

async function resolveHousehold(tx, { organizationId, householdId, numeroOrdre }) {
    if (householdId) {
        const household = await tx.household.findFirst({
            where: { id: String(householdId), organizationId, deletedAt: null }
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
                numeroordre: { equals: value, mode: 'insensitive' }
            }))
        }
    });
}

function buildSafeHouseholdUpdate(household, patch) {
    if (!isPlainObject(patch)) return null;

    const data = {
        version: (household.version || 0) + 1
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
        data.constructionData = mergeJsonField(household.constructionData || {}, patch.constructionData || {});
    }

    return data;
}

function normalizeRequiredMissing(requiredMissing) {
    if (!Array.isArray(requiredMissing)) return [];
    return requiredMissing
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
}

function uniqueStrings(values) {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function makeHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function findUniversalXlsFormDefinition(organizationId, formKey) {
    const mapping = await prisma.koboFormMapping.findUnique({
        where: {
            organizationId_koboAssetId: {
                organizationId,
                koboAssetId: formKey
            }
        }
    });

    if (!mapping || !isPlainObject(mapping.mapping)) return null;
    return {
        id: mapping.id,
        koboAssetId: mapping.koboAssetId,
        version: mapping.version,
        lastValidated: mapping.lastValidated,
        updatedAt: mapping.updatedAt,
        definition: mapping.mapping
    };
}

function summarizeUniversalXlsFormMapping(mapping) {
    const definition = isPlainObject(mapping.mapping) ? mapping.mapping : {};
    return {
        id: mapping.id,
        formKey: mapping.koboAssetId,
        formVersion: mapping.version,
        title: definition.title || mapping.koboAssetId,
        engine: definition.engine || 'gem-xlsform-universal',
        engineVersion: definition.engineVersion || XLSFORM_ENGINE_VERSION,
        diagnostics: definition.diagnostics || {},
        capabilities: definition.capabilities || [],
        lastValidated: mapping.lastValidated,
        updatedAt: mapping.updatedAt
    };
}

function sanitizeObjectWithValuePatch(value, valuePatch = {}, key = '') {
    if (key && key.startsWith('_gem_attachment_')) return OMIT_FIELD;
    if (key && Object.prototype.hasOwnProperty.call(valuePatch, key)) return valuePatch[key];
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
    return 'jpg';
}

function parseDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const buffer = Buffer.from(match[2], 'base64');
    return { mimeType: match[1], buffer };
}

async function normalizeSubmissionAttachments({ attachments, organizationId, clientSubmissionId, values }) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return { attachments: [], valuePatch: {} };
    }

    const normalized = [];
    const valuePatch = {};

    for (const rawAttachment of attachments) {
        if (!isPlainObject(rawAttachment)) continue;

        const fieldName = String(rawAttachment.fieldName || '').trim();
        const fileName = String(rawAttachment.fileName || `${fieldName || 'piece'}-${Date.now()}`).trim();
        const mimeType = String(rawAttachment.mimeType || '').trim() || 'application/octet-stream';
        const capturedAt = rawAttachment.capturedAt || new Date().toISOString();
        const baseRecord = {
            id: String(rawAttachment.id || crypto.randomUUID()),
            fieldName,
            fileName,
            mimeType,
            originalBytes: Number(rawAttachment.originalBytes || rawAttachment.size || 0) || null,
            storedBytes: Number(rawAttachment.storedBytes || rawAttachment.size || 0) || null,
            capturedAt,
            source: rawAttachment.source || 'gem-internal-kobo',
            status: 'stored'
        };

        if (rawAttachment.url || rawAttachment.key) {
            normalized.push({
                ...baseRecord,
                key: rawAttachment.key || null,
                url: rawAttachment.url || values?.[fieldName] || null,
                storage: rawAttachment.key ? 'remote' : 'external'
            });
            if (fieldName && rawAttachment.url) valuePatch[fieldName] = rawAttachment.url;
            continue;
        }

        const parsed = parseDataUrl(rawAttachment.dataUrl);
        if (!parsed) {
            normalized.push({
                ...baseRecord,
                status: 'unresolved',
                storage: 'client-reference',
                url: values?.[fieldName] || null
            });
            continue;
        }

        if (parsed.buffer.length > MAX_EMBEDDED_ATTACHMENT_BYTES) {
            throw makeHttpError(413, `Attachment ${fieldName || fileName} exceeds the internal Kobo size limit`);
        }

        const extension = extensionFromMime(parsed.mimeType || mimeType);
        const key = `${organizationId}/internal-kobo/${clientSubmissionId}/${baseRecord.id}.${extension}`;
        await uploadFile(key, parsed.buffer, parsed.mimeType || mimeType);
        const url = await getFileUrl(key);

        normalized.push({
            ...baseRecord,
            mimeType: parsed.mimeType || mimeType,
            storedBytes: parsed.buffer.length,
            key,
            url,
            storage: 'server'
        });
        if (fieldName && url) valuePatch[fieldName] = url;
    }

    return { attachments: normalized, valuePatch };
}

function escapeCsv(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function flattenSubmissionForExport(submission, valueKeys = []) {
    const values = isPlainObject(submission.values) ? submission.values : {};
    const metadata = isPlainObject(submission.metadata) ? submission.metadata : {};
    const attachments = metadata?.media?.attachments || [];
    const row = {
        id: submission.id,
        clientSubmissionId: submission.clientSubmissionId,
        numeroOrdre: submission.numeroOrdre || submission.household?.numeroordre || '',
        householdName: submission.household?.name || '',
        telephone: submission.household?.phone || values.telephone_key || '',
        region: submission.household?.region || values.region_key || '',
        role: submission.role || '',
        status: submission.status,
        syncStatus: submission.syncStatus,
        formVersion: submission.formVersion,
        requiredMissing: (submission.requiredMissing || []).join('|'),
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        attachmentUrls: Array.isArray(attachments) ? attachments.map((item) => item.url || item.key).filter(Boolean).join('|') : '',
        submittedBy: submission.submittedBy?.name || submission.submittedBy?.email || '',
        submittedAt: submission.submittedAt?.toISOString?.() || submission.submittedAt || '',
        savedAt: submission.savedAt?.toISOString?.() || submission.savedAt || '',
        reviewStatus: metadata.review?.status || '',
        reviewNote: metadata.review?.note || ''
    };

    valueKeys.forEach((key) => {
        const value = values[key];
        row[`value.${key}`] = Array.isArray(value)
            ? value.join('|')
            : isPlainObject(value)
                ? JSON.stringify(value)
                : value ?? '';
    });

    return row;
}

async function normalizeSubmissionPayload(body, req) {
    const clientSubmissionId = String(body.clientSubmissionId || '').trim();
    const formVersion = String(body.formVersion || '').trim();
    const formKey = String(body.formKey || INTERNAL_KOBO_FORM_KEY).trim() || INTERNAL_KOBO_FORM_KEY;

    if (!clientSubmissionId) {
        return { error: { status: 400, message: 'clientSubmissionId is required' } };
    }

    if (!formVersion) {
        return { error: { status: 400, message: 'formVersion is required' } };
    }

    if (!isPlainObject(body.values)) {
        return { error: { status: 400, message: 'values must be an object' } };
    }

    const universalMapping = formKey === INTERNAL_KOBO_FORM_KEY
        ? null
        : await findUniversalXlsFormDefinition(req.user.organizationId, formKey);

    if (formKey !== INTERNAL_KOBO_FORM_KEY && !universalMapping) {
        return { error: { status: 400, message: `Unsupported formKey: ${formKey}` } };
    }

    const { attachments, valuePatch } = await normalizeSubmissionAttachments({
        attachments: body.attachments,
        organizationId: req.user.organizationId,
        clientSubmissionId,
        values: body.values
    });
    const values = sanitizeObjectWithValuePatch({ ...body.values, ...valuePatch }, valuePatch);

    const roleSource = body.role ?? values.role;
    const role = roleSource ? String(roleSource).trim() : null;
    if (formKey === INTERNAL_KOBO_FORM_KEY && role && !INTERNAL_KOBO_ALLOWED_ROLES.has(role)) {
        return { error: { status: 400, message: `Unsupported role: ${role}` } };
    }

    const universalValidation = universalMapping
        ? validateXlsFormValues(universalMapping.definition, values)
        : null;
    const serverValidationIssues = universalValidation?.issues || getServerValidationIssues(values);
    const serverRequiredMissing = universalValidation?.requiredMissing || getServerRequiredMissing(values);
    const serverConstraintIssues = serverValidationIssues.filter((issue) => issue.type === 'constraint');
    const requiredMissing = uniqueStrings([
        ...normalizeRequiredMissing(body.requiredMissing),
        ...serverRequiredMissing
    ]);
    const requestedStatus = String(body.status || '').trim().toLowerCase();

    if (serverValidationIssues.length > 0 && ['submitted', 'validated'].includes(requestedStatus)) {
        return {
            error: {
                status: 422,
                message: 'Submitted internal Kobo form still has validation issues',
                details: {
                    requiredMissing,
                    validationIssues: serverValidationIssues
                }
            }
        };
    }

    const status = SUBMISSION_STATUSES.has(requestedStatus)
        ? requestedStatus
        : serverValidationIssues.length > 0
            ? 'draft'
            : 'submitted';
    const serverFormVersion = universalMapping?.definition?.formVersion || INTERNAL_KOBO_FORM_VERSION;

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
                serverEngine: universalMapping ? 'gem-xlsform-universal' : 'gem-internal-kobo',
                serverEngineVersion: universalMapping?.definition?.engineVersion || XLSFORM_ENGINE_VERSION,
                serverFormKeyResolved: universalMapping?.definition?.formKey || INTERNAL_KOBO_FORM_KEY,
                serverFormVersion,
                formVersionMismatch: formVersion !== serverFormVersion,
                universalFormDiagnostics: universalMapping?.definition?.diagnostics || null,
                media: {
                    ...(isPlainObject(body.metadata?.media) ? body.metadata.media : {}),
                    attachments,
                    attachmentCount: attachments.length
                },
                serverRequiredMissing,
                serverValidationIssues,
                serverConstraintIssues,
                unresolvedCalculations: universalValidation?.unresolvedCalculations || [],
                requestId: req.get('x-request-id') || crypto.randomUUID(),
                receivedAt: new Date().toISOString(),
                receivedFromIp: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.get('user-agent') || null
            },
            requiredMissing,
            submittedAt: ['submitted', 'validated'].includes(status) ? new Date() : null,
            savedAt: new Date(),
            householdPatch: sanitizeObjectWithValuePatch(body.householdPatch, valuePatch)
        }
    };
}

export const submitInternalKoboSubmission = async (req, res) => {
    const { organizationId, id: userId } = req.user;
    let normalized;
    try {
        normalized = await normalizeSubmissionPayload(req.body || {}, req);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error while preparing internal Kobo submission' : err.message
        });
    }

    const { payload, error } = normalized;

    if (error) {
        return res.status(error.status).json({ success: false, message: error.message, details: error.details });
    }

    try {
        let updatedHousehold = null;

        const submission = await prisma.$transaction(async (tx) => {
            const resolvedHousehold = await resolveHousehold(tx, {
                organizationId,
                householdId: payload.householdId,
                numeroOrdre: payload.numeroOrdre
            });

            if (resolvedHousehold && payload.numeroOrdre) {
                const numeroVariants = normalizeNumeroVariants(payload.numeroOrdre).map((value) => value.toLowerCase());
                const resolvedNumero = String(resolvedHousehold.numeroordre || '').trim().toLowerCase();
                if (resolvedNumero && !numeroVariants.includes(resolvedNumero)) {
                    throw makeHttpError(409, 'Household target does not match submitted numeroOrdre');
                }
            }

            if (payload.formKey === INTERNAL_KOBO_FORM_KEY && ['submitted', 'validated'].includes(payload.status) && !resolvedHousehold) {
                throw makeHttpError(404, 'Submitted internal Kobo form must target an existing household');
            }

            const existingSubmission = await tx.internalKoboSubmission.findUnique({
                where: {
                    organizationId_clientSubmissionId: {
                        organizationId,
                        clientSubmissionId: payload.clientSubmissionId
                    }
                },
                select: {
                    id: true,
                    status: true
                }
            });

            if (['validated', 'rejected'].includes(existingSubmission?.status)) {
                throw makeHttpError(409, 'Final reviewed internal Kobo submission cannot be overwritten');
            }

            if (existingSubmission?.status === 'submitted' && payload.status !== 'submitted') {
                throw makeHttpError(409, 'Submitted internal Kobo form cannot be downgraded or reviewed by the submit endpoint');
            }

            const submissionRecord = await tx.internalKoboSubmission.upsert({
                where: {
                    organizationId_clientSubmissionId: {
                        organizationId,
                        clientSubmissionId: payload.clientSubmissionId
                    }
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
                    savedAt: payload.savedAt
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
                    savedAt: payload.savedAt
                }
            });

            if (resolvedHousehold && payload.householdPatch) {
                const householdUpdate = buildSafeHouseholdUpdate(resolvedHousehold, payload.householdPatch);
                if (householdUpdate) {
                    updatedHousehold = await tx.household.update({
                        where: { id: resolvedHousehold.id },
                        data: householdUpdate
                    });
                }
            }

            await tx.syncLog.create({
                data: {
                    userId,
                    organizationId,
                    deviceId: String(payload.metadata?.deviceId || 'gem-internal-kobo'),
                    action: 'INTERNAL_KOBO_SUBMISSION',
                    details: {
                        submissionId: submissionRecord.id,
                        clientSubmissionId: payload.clientSubmissionId,
                        householdId: resolvedHousehold?.id || null,
                        numeroOrdre: resolvedHousehold?.numeroordre || payload.numeroOrdre,
                        status: payload.status,
                        formVersion: payload.formVersion,
                        requiredMissing: payload.requiredMissing,
                        validationIssues: payload.metadata.serverValidationIssues,
                        serverFormVersion: INTERNAL_KOBO_FORM_VERSION,
                        formVersionMismatch: payload.metadata.formVersionMismatch
                    }
                }
            });

            return submissionRecord;
        });

        if (updatedHousehold) {
            try {
                eventBus.emit('household:upsert', {
                    action: 'update',
                    household: sanitizeBigIntForJson(updatedHousehold)
                });
            } catch (eventError) {
                console.error('[INTERNAL-KOBO] event emit error:', eventError.message);
            }
        }

        try {
            await tracerAction({
                userId,
                organizationId,
                action: 'SOUMISSION_KOBO_INTERNE',
                resource: 'InternalKoboSubmission',
                resourceId: submission.id,
                details: {
                    clientSubmissionId: payload.clientSubmissionId,
                    householdId: updatedHousehold?.id || payload.householdId || null,
                    status: payload.status,
                    formVersion: payload.formVersion,
                    requiredMissing: payload.requiredMissing,
                    validationIssues: payload.metadata.serverValidationIssues,
                    formVersionMismatch: payload.metadata.formVersionMismatch
                },
                req
            });
        } catch (auditError) {
            console.error('[INTERNAL-KOBO] audit log error:', auditError.message);
        }

        return res.status(201).json({
            success: true,
            submission: sanitizeBigIntForJson(submission),
            household: updatedHousehold ? sanitizeBigIntForJson(updatedHousehold) : null
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] submit error:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error while saving internal Kobo submission' : err.message
        });
    }
};

export const getInternalKoboFormDefinition = async (req, res) => {
    try {
        const importedMappings = await prisma.koboFormMapping.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { updatedAt: 'desc' },
            take: 20
        });
        const importedForms = importedMappings.map(summarizeUniversalXlsFormMapping);

        return res.json({
            success: true,
            form: {
                formKey: INTERNAL_KOBO_FORM_KEY,
                formVersion: INTERNAL_KOBO_FORM_VERSION,
                engine: 'gem-internal-kobo',
                allowedRoles: Array.from(INTERNAL_KOBO_ALLOWED_ROLES),
                serverValidation: true,
                xlsFormImport: true,
                universalEngine: {
                    enabled: true,
                    engine: 'gem-xlsform-universal',
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
                        'media'
                    ]
                },
                media: {
                    embeddedOfflineMedia: true,
                    maxEmbeddedAttachmentBytes: MAX_EMBEDDED_ATTACHMENT_BYTES
                }
            }
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] form-definition error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading internal Kobo form definition'
        });
    }
};

export const listInternalKoboFormDefinitions = async (req, res) => {
    try {
        const mappings = await prisma.koboFormMapping.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { updatedAt: 'desc' }
        });

        return res.json({
            success: true,
            count: mappings.length,
            forms: mappings.map(summarizeUniversalXlsFormMapping)
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] form-definitions list error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while listing XLSForm definitions'
        });
    }
};

export const getInternalKoboImportedFormDefinition = async (req, res) => {
    try {
        const formKey = String(req.params.formKey || '').trim();
        const mapping = await findUniversalXlsFormDefinition(req.user.organizationId, formKey);
        if (!mapping) {
            return res.status(404).json({
                success: false,
                message: 'XLSForm definition not found'
            });
        }

        return res.json({
            success: true,
            form: sanitizeBigIntForJson(mapping.definition)
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] form-definition get error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading XLSForm definition'
        });
    }
};

export const importInternalKoboXlsForm = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: 'XLSForm file is required' });
        }

        const { organizationId, id: userId } = req.user;
        const importedDefinition = await parseXlsFormBuffer(req.file.buffer, {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const importId = crypto.randomUUID();
        const baseKey = `${organizationId}/internal-kobo/forms/${importId}`;

        await uploadFile(`${baseKey}.xlsx`, req.file.buffer, req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await uploadFile(
            `${baseKey}.json`,
            Buffer.from(JSON.stringify(importedDefinition, null, 2), 'utf8'),
            'application/json'
        );

        await prisma.koboFormMapping.upsert({
            where: {
                organizationId_koboAssetId: {
                    organizationId,
                    koboAssetId: importedDefinition.formKey
                }
            },
            create: {
                organizationId,
                koboAssetId: importedDefinition.formKey,
                version: importedDefinition.formVersion,
                mapping: importedDefinition
            },
            update: {
                version: importedDefinition.formVersion,
                mapping: importedDefinition,
                lastValidated: new Date()
            }
        });

        await prisma.syncLog.create({
            data: {
                userId,
                organizationId,
                deviceId: 'gem-internal-kobo-admin',
                action: 'INTERNAL_KOBO_XLSFORM_IMPORT',
                details: {
                    importId,
                    fileName: req.file.originalname,
                    formKey: importedDefinition.formKey,
                    formVersion: importedDefinition.formVersion,
                    diagnostics: importedDefinition.diagnostics,
                    engine: importedDefinition.engine,
                    engineVersion: importedDefinition.engineVersion,
                    capabilities: importedDefinition.capabilities
                }
            }
        });

        return res.status(201).json({
            success: true,
            importId,
            storageKey: `${baseKey}.json`,
            form: {
                formKey: importedDefinition.formKey,
                formVersion: importedDefinition.formVersion,
                title: importedDefinition.title,
                engine: importedDefinition.engine,
                engineVersion: importedDefinition.engineVersion,
                capabilities: importedDefinition.capabilities,
                diagnostics: importedDefinition.diagnostics
            }
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] XLSForm import error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while importing XLSForm'
        });
    }
};

function buildSubmissionWhere(organizationId, query = {}) {
    const {
        householdId,
        numeroOrdre,
        status,
        syncStatus,
        role,
        formKey,
        clientSubmissionId,
        q,
        from,
        to
    } = query;
    const numeroVariants = normalizeNumeroVariants(numeroOrdre);
    const filters = [{ organizationId }];

    if (householdId) filters.push({ householdId: String(householdId) });
    if (numeroVariants.length > 0) {
        filters.push({
            OR: numeroVariants.map((value) => ({ numeroOrdre: { equals: value, mode: 'insensitive' } }))
        });
    }
    if (status) filters.push({ status: String(status) });
    if (syncStatus) filters.push({ syncStatus: String(syncStatus) });
    if (role) filters.push({ role: String(role) });
    if (formKey) filters.push({ formKey: String(formKey) });
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
                                { village: { contains: search, mode: 'insensitive' } }
                            ]
                        }
                    }
                }
            ]
        });
    }

    return filters.length === 1 ? filters[0] : { AND: filters };
}

function internalKoboSubmissionInclude() {
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
                updatedAt: true
            }
        },
        submittedBy: {
            select: {
                id: true,
                name: true,
                email: true
            }
        }
    };
}

export const exportInternalKoboSubmissions = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const format = String(req.query.format || 'csv').toLowerCase();
        const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 5000);
        const where = buildSubmissionWhere(organizationId, req.query);
        const submissions = await prisma.internalKoboSubmission.findMany({
            where,
            include: internalKoboSubmissionInclude(),
            orderBy: { savedAt: 'desc' },
            take
        });

        const valueKeys = Array.from(new Set(
            submissions.flatMap((submission) =>
                Object.keys(isPlainObject(submission.values) ? submission.values : {}).filter((key) => !key.startsWith('_gem_attachment_'))
            )
        )).sort();
        const rows = submissions.map((submission) => flattenSubmissionForExport(submission, valueKeys));
        const generatedAt = new Date().toISOString();
        const baseFilename = `soumissions-kobo-interne-${generatedAt.slice(0, 10)}`;

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.json"`);
            return res.send(JSON.stringify({ generatedAt, count: submissions.length, submissions: sanitizeBigIntForJson(submissions) }, null, 2));
        }

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('soumissions');
            const headers = Object.keys(rows[0] || flattenSubmissionForExport({}, valueKeys));
            worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 4, 14), 42) }));
            rows.forEach((row) => worksheet.addRow(row));
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];

            const buffer = await workbook.xlsx.writeBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xlsx"`);
            return res.send(Buffer.from(buffer));
        }

        const headers = Object.keys(rows[0] || flattenSubmissionForExport({}, valueKeys));
        const csv = [
            headers.map(escapeCsv).join(','),
            ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error('[INTERNAL-KOBO] export error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while exporting internal Kobo submissions'
        });
    }
};

export const reviewInternalKoboSubmission = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { id } = req.params;
        const nextStatus = String(req.body.status || '').trim().toLowerCase();
        const note = String(req.body.note || '').trim();

        if (!REVIEW_STATUSES.has(nextStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Review status must be submitted, validated or rejected'
            });
        }

        const current = await prisma.internalKoboSubmission.findFirst({ where: { id, organizationId } });
        if (!current) {
            return res.status(404).json({ success: false, message: 'Internal Kobo submission not found' });
        }

        const currentMetadata = isPlainObject(current.metadata) ? current.metadata : {};
        const currentValidationIssues = Array.isArray(currentMetadata.serverValidationIssues)
            ? currentMetadata.serverValidationIssues
            : [];
        const hasBlockingIssues = (current.requiredMissing || []).length > 0 || currentValidationIssues.length > 0;

        if (nextStatus === 'validated' && hasBlockingIssues) {
            return res.status(422).json({
                success: false,
                message: 'Internal Kobo submission cannot be validated while required or constraint issues remain',
                details: {
                    requiredMissing: current.requiredMissing || [],
                    validationIssues: currentValidationIssues
                }
            });
        }

        const metadata = {
            ...currentMetadata,
            review: {
                status: nextStatus,
                note,
                reviewedById: userId,
                reviewedAt: new Date().toISOString()
            }
        };

        const submission = await prisma.internalKoboSubmission.update({
            where: { id: current.id },
            data: {
                status: nextStatus,
                metadata,
                syncStatus: 'synced',
                savedAt: new Date()
            },
            include: internalKoboSubmissionInclude()
        });

        await prisma.syncLog.create({
            data: {
                userId,
                organizationId,
                deviceId: 'gem-internal-kobo-admin',
                action: 'INTERNAL_KOBO_REVIEW',
                details: {
                    submissionId: current.id,
                    clientSubmissionId: current.clientSubmissionId,
                    previousStatus: current.status,
                    nextStatus,
                    note,
                    requiredMissing: current.requiredMissing || [],
                    validationIssues: currentValidationIssues
                }
            }
        });

        try {
            await tracerAction({
                userId,
                organizationId,
                action: 'REVUE_KOBO_INTERNE',
                resource: 'InternalKoboSubmission',
                resourceId: submission.id,
                details: {
                    clientSubmissionId: current.clientSubmissionId,
                    previousStatus: current.status,
                    nextStatus,
                    note,
                    requiredMissing: current.requiredMissing || [],
                    validationIssues: currentValidationIssues
                },
                req
            });
        } catch (auditError) {
            console.error('[INTERNAL-KOBO] review audit log error:', auditError.message);
        }

        return res.json({ success: true, submission: sanitizeBigIntForJson(submission) });
    } catch (err) {
        console.error('[INTERNAL-KOBO] review error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while reviewing internal Kobo submission'
        });
    }
};

export const listInternalKoboSubmissions = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const {
            householdId,
            numeroOrdre,
            status,
            syncStatus,
            role,
            formKey,
            clientSubmissionId,
            q,
            from,
            to,
            limit = '100'
        } = req.query;
        const take = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        const numeroVariants = normalizeNumeroVariants(numeroOrdre);
        const filters = [{ organizationId }];

        if (householdId) filters.push({ householdId: String(householdId) });
        if (numeroVariants.length > 0) {
            filters.push({
                OR: numeroVariants.map((value) => ({ numeroOrdre: { equals: value, mode: 'insensitive' } }))
            });
        }
        if (status) filters.push({ status: String(status) });
        if (syncStatus) filters.push({ syncStatus: String(syncStatus) });
        if (role) filters.push({ role: String(role) });
        if (formKey) filters.push({ formKey: String(formKey) });
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
                                    { village: { contains: search, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                ]
            });
        }

        const where = filters.length === 1 ? filters[0] : { AND: filters };

        const submissions = await prisma.internalKoboSubmission.findMany({
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
                        updatedAt: true
                    }
                },
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { savedAt: 'desc' },
            take
        });

        const countBy = (key) =>
            submissions.reduce((acc, submission) => {
                const value = String(submission[key] || 'non_renseigne');
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {});

        const diagnostics = {
            scope: 'filtered',
            count: submissions.length,
            byStatus: countBy('status'),
            byRole: countBy('role'),
            bySyncStatus: countBy('syncStatus'),
            missingRequiredCount: submissions.filter((submission) => (submission.requiredMissing || []).length > 0).length,
            validationIssueCount: submissions.filter(
                (submission) => Array.isArray(submission.metadata?.serverValidationIssues) && submission.metadata.serverValidationIssues.length > 0
            ).length,
            versionMismatchCount: submissions.filter((submission) => submission.metadata?.formVersionMismatch === true).length,
            latestSavedAt: submissions[0]?.savedAt || null,
            serverFormVersion: INTERNAL_KOBO_FORM_VERSION,
            generatedAt: new Date().toISOString()
        };

        return res.json({
            success: true,
            count: submissions.length,
            diagnostics,
            submissions: sanitizeBigIntForJson(submissions)
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] list error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching internal Kobo submissions'
        });
    }
};

export const getInternalKoboDiagnostics = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [total, last24h, latestSubmissions] = await Promise.all([
            prisma.internalKoboSubmission.count({ where: { organizationId } }),
            prisma.internalKoboSubmission.count({ where: { organizationId, savedAt: { gte: recentSince } } }),
            prisma.internalKoboSubmission.findMany({
                where: { organizationId },
                orderBy: { savedAt: 'desc' },
                take: 1000,
                select: {
                    id: true,
                    numeroOrdre: true,
                    role: true,
                    status: true,
                    syncStatus: true,
                    formVersion: true,
                    metadata: true,
                    requiredMissing: true,
                    savedAt: true,
                    submittedAt: true,
                    householdId: true
                }
            })
        ]);

        const countBy = (values, selector) =>
            values.reduce((acc, item) => {
                const value = String(selector(item) || 'non_renseigne');
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {});

        const versionMismatchCount = latestSubmissions.filter(
            (submission) => submission.metadata?.formVersionMismatch === true || submission.formVersion !== INTERNAL_KOBO_FORM_VERSION
        ).length;
        const missingRequiredCount = latestSubmissions.filter(
            (submission) => (submission.requiredMissing || []).length > 0
        ).length;
        const validationIssueCount = latestSubmissions.filter(
            (submission) => Array.isArray(submission.metadata?.serverValidationIssues) && submission.metadata.serverValidationIssues.length > 0
        ).length;
        const unresolvedHouseholdCount = latestSubmissions.filter((submission) => !submission.householdId).length;
        const warningMessages = [];

        if (versionMismatchCount > 0) {
            warningMessages.push(`${versionMismatchCount} soumission(s) avec une version XLSForm differente du serveur`);
        }
        if (missingRequiredCount > 0) {
            warningMessages.push(`${missingRequiredCount} brouillon(s) ou fiche(s) avec champs requis manquants`);
        }
        if (validationIssueCount > 0) {
            warningMessages.push(`${validationIssueCount} soumission(s) avec correction de valeur a traiter`);
        }
        if (unresolvedHouseholdCount > 0) {
            warningMessages.push(`${unresolvedHouseholdCount} soumission(s) non rattachee(s) a un menage serveur`);
        }

        const health =
            unresolvedHouseholdCount > 0 || versionMismatchCount > 0 || validationIssueCount > 0
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
                versionMismatchCount,
                missingRequiredCount,
                validationIssueCount,
                unresolvedHouseholdCount,
                latestSavedAt: latestSubmissions[0]?.savedAt || null,
                serverFormVersion: INTERNAL_KOBO_FORM_VERSION,
                warnings: warningMessages,
                generatedAt: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] diagnostics error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching internal Kobo diagnostics'
        });
    }
};

export const getInternalKoboSubmission = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { id } = req.params;

        const submission = await prisma.internalKoboSubmission.findFirst({
            where: { id, organizationId },
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
                        updatedAt: true
                    }
                },
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Internal Kobo submission not found'
            });
        }

        return res.json({
            success: true,
            submission: sanitizeBigIntForJson(submission)
        });
    } catch (err) {
        console.error('[INTERNAL-KOBO] get error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching internal Kobo submission'
        });
    }
};

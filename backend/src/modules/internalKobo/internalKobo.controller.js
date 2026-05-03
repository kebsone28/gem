import prisma from '../../core/utils/prisma.js';
import eventBus from '../../core/utils/eventBus.js';
import { tracerAction } from '../../services/audit.service.js';

const SUBMISSION_STATUSES = new Set(['draft', 'submitted', 'validated', 'rejected']);

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

function normalizeSubmissionPayload(body, req) {
    const clientSubmissionId = String(body.clientSubmissionId || '').trim();
    const formVersion = String(body.formVersion || '').trim();

    if (!clientSubmissionId) {
        return { error: { status: 400, message: 'clientSubmissionId is required' } };
    }

    if (!formVersion) {
        return { error: { status: 400, message: 'formVersion is required' } };
    }

    if (!isPlainObject(body.values)) {
        return { error: { status: 400, message: 'values must be an object' } };
    }

    const requiredMissing = normalizeRequiredMissing(body.requiredMissing);
    const requestedStatus = String(body.status || '').trim().toLowerCase();
    const status = SUBMISSION_STATUSES.has(requestedStatus)
        ? requestedStatus
        : requiredMissing.length > 0
            ? 'draft'
            : 'submitted';

    return {
        payload: {
            clientSubmissionId,
            formKey: String(body.formKey || 'terrain_internal').trim() || 'terrain_internal',
            formVersion,
            householdId: body.householdId ? String(body.householdId) : null,
            numeroOrdre: body.numeroOrdre ? String(body.numeroOrdre).trim() : null,
            role: body.role ? String(body.role).trim() : null,
            status,
            syncStatus: 'synced',
            values: body.values,
            metadata: {
                ...(isPlainObject(body.metadata) ? body.metadata : {}),
                receivedAt: new Date().toISOString(),
                userAgent: req.get('user-agent') || null
            },
            requiredMissing,
            submittedAt: status === 'submitted' ? new Date() : null,
            savedAt: new Date(),
            householdPatch: body.householdPatch
        }
    };
}

export const submitInternalKoboSubmission = async (req, res) => {
    const { organizationId, id: userId } = req.user;
    const { payload, error } = normalizeSubmissionPayload(req.body || {}, req);

    if (error) {
        return res.status(error.status).json({ success: false, message: error.message });
    }

    try {
        let updatedHousehold = null;

        const submission = await prisma.$transaction(async (tx) => {
            const resolvedHousehold = await resolveHousehold(tx, {
                organizationId,
                householdId: payload.householdId,
                numeroOrdre: payload.numeroOrdre
            });

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
                        formVersion: payload.formVersion
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
                    formVersion: payload.formVersion
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
        return res.status(500).json({
            success: false,
            message: 'Server error while saving internal Kobo submission'
        });
    }
};

export const listInternalKoboSubmissions = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { householdId, numeroOrdre, status, formKey, clientSubmissionId, limit = '100' } = req.query;
        const take = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        const numeroVariants = normalizeNumeroVariants(numeroOrdre);

        const where = {
            organizationId,
            ...(householdId ? { householdId: String(householdId) } : {}),
            ...(numeroVariants.length > 0
                ? { OR: numeroVariants.map((value) => ({ numeroOrdre: { equals: value, mode: 'insensitive' } })) }
                : {}),
            ...(status ? { status: String(status) } : {}),
            ...(formKey ? { formKey: String(formKey) } : {}),
            ...(clientSubmissionId ? { clientSubmissionId: String(clientSubmissionId) } : {})
        };

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

        return res.json({
            success: true,
            count: submissions.length,
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

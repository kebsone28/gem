import prisma, { basePrisma } from '../../core/utils/prisma.js';
import eventBus from '../../core/utils/eventBus.js';
import EventPublisher from '../../core/utils/EventPublisher.js';
import { tracerAction } from '../../services/audit.service.js';
import { logPerformance } from '../../services/performance.service.js';
import {
    LEGACY_SAFE_HOUSEHOLD_READ_SELECT,
    normalizeLegacyHousehold
} from './household.compat.js';
import {
    HOUSEHOLD_STATUS,
    isValidHouseholdTransition,
    getDefaultHouseholdWorkflow,
    HOUSEHOLD_APPROVAL_STEPS,
} from '../../core/config/businessRules.js';
import logger from '../../utils/logger.js';

function sanitizeBigIntForJson(value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeBigIntForJson(item));
    }

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

function setNestedValue(target, path, value) {
    const keys = path.split('.');
    let current = target;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!isPlainObject(current[key])) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

function mergeJsonField(existingValue, nextValue) {
    if (!isPlainObject(existingValue) || !isPlainObject(nextValue)) {
        return nextValue;
    }

    return {
        ...existingValue,
        ...nextValue
    };
}

// @desc    Get all households for an organization
// @route   GET /api/households
export const getHouseholds = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId, zoneId, grappeId, status, bbox, limit = '100', page = '1', search } = req.query;

        const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const skip = (pageNum - 1) * limitNum;

        const where = {
            organizationId,
            deletedAt: null
        };

        // 🛡️ Isolation Multi-Tenant par Projet
        const activeProjectId = req.projectId || projectId;
        if (activeProjectId) {
            where.projectId = activeProjectId;
        }

        if (search) {
            const searchTerm = String(search).trim();
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { numeroordre: { contains: searchTerm, mode: 'insensitive' } },
                { owner: { path: ['chefNom'], string_contains: searchTerm } }, // Fallback pour les données structurées
                { owner: { path: ['chefPrenom'], string_contains: searchTerm } }
            ];
        }

        if (zoneId) {
            where.zoneId = zoneId;
        }

        if (grappeId) {
            where.grappeId = grappeId === '__unclassified__' ? null : grappeId;
        }

        if (status) {
            where.status = status;
        }

        const households = await prisma.household.findMany({
            where,
            select: LEGACY_SAFE_HOUSEHOLD_READ_SELECT,
            orderBy: { updatedAt: 'desc' },
            skip,
            take: limitNum
        });

        res.json({
            households: sanitizeBigIntForJson(households.map(normalizeLegacyHousehold)),
            page: pageNum,
            limit: limitNum,
            hasMore: households.length === limitNum
        });
    } catch (error) {
        logger.error('Get households error:', error);
        res.status(500).json({ error: 'Server error while fetching households' });
    }
};

// @desc    Get total households count
// @route   GET /api/households/count
export const getHouseholdsCount = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const count = await prisma.household.count({
            where: {
                organizationId,
                deletedAt: null
            }
        });
        res.json({ count });
    } catch (error) {
        logger.error('Get households count error:', error);
        res.status(500).json({ error: 'Server error while fetching household count' });
    }
};

// @desc    Get single household
// @route   GET /api/households/:id
export const getHouseholdById = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const household = await prisma.household.findFirst({
            where: { 
                id, 
                organizationId, 
                deletedAt: null,
                ...(req.projectId ? { projectId: req.projectId } : {})
            },
            select: LEGACY_SAFE_HOUSEHOLD_READ_SELECT
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        res.json(sanitizeBigIntForJson(normalizeLegacyHousehold(household)));
    } catch (error) {
        logger.error('Get household error:', error);
        res.status(500).json({ error: 'Server error while fetching household' });
    }
};

// @desc    Create new household
export const createHousehold = async (req, res) => {
    try {
        const { 
            zoneId: requestedZoneId, status, location, owner, 
            koboData, koboSync, assignedTeams,
            name, phone, region, departement, village, numeroordre
        } = req.body;
        const { organizationId } = req.user;

        let resolvedZoneId = requestedZoneId;

        if (resolvedZoneId) {
            const zone = await prisma.zone.findUnique({ where: { id: resolvedZoneId } });
            if (!zone) resolvedZoneId = null;
        }

        if (!resolvedZoneId) {
            const defaultZone = await prisma.zone.findFirst({
                where: { organizationId },
                orderBy: { id: 'asc' }
            });

            if (!defaultZone) {
                return res.status(400).json({ error: 'Aucune zone disponible.' });
            }
            resolvedZoneId = defaultZone.id;
        }

        const household = await prisma.household.create({
            data: {
                zoneId: resolvedZoneId,
                projectId: req.projectId || null, // Associer au projet actif
                organizationId,
                status: status || 'planned',
                location: location || {},
                owner: owner || {},
                koboData: koboData ?? {},
                koboSync: koboSync ?? {},
                assignedTeams: assignedTeams || [],
                name: name || null,
                phone: phone || null,
                region: region || null,
                departement: departement || null,
                village: village || null,
                numeroordre: numeroordre || null
            }
        });

        // Publish SSE event (dev-friendly incremental update)
        try {
            const payload = sanitizeBigIntForJson(household);
            eventBus.emit('household:upsert', { action: 'upsert', household: payload });
            await EventPublisher.publish({
                organizationId,
                projectId: req.projectId || null,
                userId: req.user?.id,
                type: 'household.created',
                resource: 'household',
                resourceId: household.id,
                data: { household: payload }
            });
        } catch (e) {
            logger.error('EventBus emit createHousehold error:', e.message);
        }

        // Sync PostGIS
        if (location && Array.isArray(location.coordinates)) {
            await prisma.$executeRaw`
                UPDATE "Household"
                SET location_gis = ST_SetSRID(ST_MakePoint(${location.coordinates[0]}, ${location.coordinates[1]}), 4326)
                WHERE id = ${household.id}
            `;
        }

        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_MENAGE',
            resource: 'Ménage',
            resourceId: household.id,
            details: { zoneId: resolvedZoneId, status: household.status },
            req
        });

        res.status(201).json(sanitizeBigIntForJson(household));
    } catch (error) {
        logger.error('Create household error:', error);
        res.status(500).json({ error: 'Server error while creating household' });
    }
};

// @desc    Update household
export const updateHousehold = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;
        const updates = req.body || {};

        const household = await prisma.household.findFirst({
            where: { 
                id, 
                organizationId, 
                deletedAt: null,
                ...(req.projectId ? { projectId: req.projectId } : {})
            },
            include: { zone: { select: { projectId: true } } }
        });

        if (!household) {
            return res.status(404).json({ error: 'Ménage introuvable' });
        }

        // Optimistic concurrency check
        const expectedVersion = updates.expectedVersion ?? parseInt(req.headers['if-match'], 10);
        if (expectedVersion !== undefined && !isNaN(expectedVersion) && household.version !== expectedVersion) {
            return res.status(409).json({
                error: 'Ce ménage a été modifié par un autre utilisateur. Veuillez recharger et réessayer.',
                currentVersion: household.version,
            });
        }

        // Validate status transition
        if (updates.status && updates.status !== household.status) {
            const transitionCheck = isValidHouseholdTransition(household.status, updates.status);
            if (!transitionCheck) {
                return res.status(400).json({
                    error: `Transition de statut invalide: "${household.status}" → "${updates.status}".`
                });
            }
        }

        const unlockFields = Array.isArray(updates.unlockFields) ? updates.unlockFields : [];
        const requestedManualOverrides = Array.isArray(updates.manualOverrides) ? updates.manualOverrides : null;

        const normalizedUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (key === 'unlockFields' || key === 'manualOverrides') continue;

            if (key.includes('.')) {
                setNestedValue(normalizedUpdates, key, value);
            } else {
                normalizedUpdates[key] = value;
            }
        }

        let manualOverrides = Array.isArray(household.manualOverrides) ? [...household.manualOverrides] : [];
        if (requestedManualOverrides) {
            manualOverrides = [...new Set(requestedManualOverrides.filter(Boolean))];
        }
        if (unlockFields.length > 0) {
            manualOverrides = manualOverrides.filter((field) => !unlockFields.includes(field));
        }

        const data = {
            ...normalizedUpdates,
            version: (household.version || 0) + 1,
            manualOverrides
        };

        if (normalizedUpdates.owner !== undefined) {
            data.owner = mergeJsonField(household.owner || {}, normalizedUpdates.owner || {});
        }

        if (normalizedUpdates.koboData !== undefined) {
            data.koboData = mergeJsonField(household.koboData || {}, normalizedUpdates.koboData || {});
        }

        if (normalizedUpdates.koboSync !== undefined) {
            data.koboSync = mergeJsonField(household.koboSync || {}, normalizedUpdates.koboSync || {});
        }

        if (normalizedUpdates.constructionData !== undefined) {
            data.constructionData = mergeJsonField(
                household.constructionData || {},
                normalizedUpdates.constructionData || {}
            );
        }

        if (normalizedUpdates.location !== undefined) {
            data.location = mergeJsonField(household.location || {}, normalizedUpdates.location || {});
        }

        const updated = await prisma.household.update({
            where: { id },
            data
        });

        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'MODIFICATION_MENAGE',
            resource: 'Ménage',
            resourceId: id,
            details: { oldStatus: household.status, newStatus: updates.status },
            req
        });

        // Publish SSE event notifying listeners an update occurred
        try {
            const payload = sanitizeBigIntForJson(updated);
            eventBus.emit('household:upsert', { action: 'update', household: payload });
            await EventPublisher.publish({
                organizationId,
                projectId: req.projectId || household.projectId || null,
                userId: req.user?.id,
                type: 'household.updated',
                resource: 'household',
                resourceId: id,
                data: {
                    previousState: { status: household.status },
                    newState: { status: updated.status }
                }
            });
        } catch (e) {
            logger.error('EventBus emit updateHousehold error:', e.message);
        }

        res.json(sanitizeBigIntForJson(updated));
    } catch (error) {
        logger.error('Update household error:', error);
        res.status(500).json({ error: 'Server error while updating household' });
    }
};

// @desc    Get household by numeroordre
export const getHouseholdByNumero = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { numeroordre } = req.params;
        const normalizedNumero = String(numeroordre || '').trim();

        if (!normalizedNumero) {
            return res.status(400).json({ error: 'Numero ordre is required' });
        }

        const numeroVariants = Array.from(new Set([
            normalizedNumero,
            normalizedNumero.replace(/^0+/, '') || normalizedNumero,
        ]));

        const household = await basePrisma.household.findFirst({
            where: {
                organizationId,
                deletedAt: null,
                OR: numeroVariants.map((value) => ({
                    numeroordre: { equals: value, mode: 'insensitive' }
                }))
            },
            include: { zone: { select: { name: true, projectId: true } } }
        });

        if (!household) return res.status(404).json({ error: 'Household not found' });
        res.json({ household: sanitizeBigIntForJson(household) });
    } catch (error) {
        logger.error('Get household by numero error:', error);
        res.status(500).json({ error: 'Server error while fetching household' });
    }
};

// ===============================================
// HOUSEHOLD APPROVAL WORKFLOW
// ===============================================

/**
 * Get household approval history
 */
export const getHouseholdApprovalHistory = async (req, res) => {
    try {
        const { householdId } = req.params;
        const { organizationId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id: householdId, organizationId },
            select: { id: true, constructionData: true, createdAt: true, updatedAt: true }
        });

        if (!household) return res.status(404).json({ error: 'Household not found' });

        const constructionData = household.constructionData || {};
        let workflow = constructionData.approvalWorkflow;

        if (!workflow) {
            workflow = getDefaultHouseholdWorkflow(household.id, household.createdAt);
        }

        res.json(workflow);
    } catch (error) {
        logger.error('Get approval history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Approve a household step
 */
export const approveHouseholdStep = async (req, res) => {
    try {
        const { householdId } = req.params;
        const { role, comments } = req.body;
        const { organizationId, id: userId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id: householdId, organizationId }
        });

        if (!household) return res.status(404).json({ error: 'Household not found' });

        const constructionData = household.constructionData || {};
        let workflow = constructionData.approvalWorkflow || getDefaultHouseholdWorkflow(household.id);

        const stepIndex = workflow.steps.findIndex(s => s.role === role);
        if (stepIndex === -1) return res.status(400).json({ error: 'Role invalide' });

        const targetStep = workflow.steps[stepIndex];
        if (targetStep.status === 'approved') {
            return res.status(400).json({ error: 'Cette étape a déjà été approuvée.' });
        }

        const prevSteps = workflow.steps.slice(0, stepIndex);
        const allPrevApproved = prevSteps.every(s => s.status === 'approved');
        if (!allPrevApproved) {
            return res.status(400).json({ error: 'Les étapes précédentes doivent être approuvées d\'abord.' });
        }

        workflow.steps[stepIndex] = {
            ...targetStep,
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date().toISOString(),
            comments: comments
        };

        const allApproved = workflow.steps.every(s => s.status === 'approved');
        workflow.overallStatus = allApproved ? 'approved' : 'in_progress';
        workflow.updatedAt = new Date().toISOString();

        const newHouseholdStatus = allApproved ? HOUSEHOLD_STATUS.VALIDATED : household.status;

        const transitionCheck = isValidHouseholdTransition(household.status, newHouseholdStatus);
        if (!transitionCheck) {
            return res.status(400).json({
                error: `Transition de statut invalide: ${household.status} → ${newHouseholdStatus}`
            });
        }

        await prisma.household.update({
            where: { id: householdId },
            data: {
                constructionData: {
                    ...constructionData,
                    approvalWorkflow: workflow
                },
                status: newHouseholdStatus
            }
        });

        await tracerAction({
            userId, organizationId,
            action: 'HOUSEHOLD_STEP_APPROVED',
            resource: 'Ménage', resourceId: householdId,
            details: { role }, req
        });

        res.json(workflow);
    } catch (error) {
        logger.error('Approve step error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Reject a household step
 */
export const rejectHouseholdStep = async (req, res) => {
    try {
        const { householdId } = req.params;
        const { role, reason } = req.body;
        const { organizationId, id: userId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id: householdId, organizationId }
        });

        if (!household) return res.status(404).json({ error: 'Household not found' });

        const constructionData = household.constructionData || {};
        let workflow = constructionData.approvalWorkflow;

        if (!workflow) return res.status(400).json({ error: 'Aucun workflow trouvé.' });

        const stepIndex = workflow.steps.findIndex(s => s.role === role);
        if (stepIndex === -1) return res.status(400).json({ error: 'Rôle invalide' });

        workflow.steps[stepIndex] = {
            ...workflow.steps[stepIndex],
            status: 'rejected',
            approvedBy: userId,
            approvedAt: new Date().toISOString(),
            comments: reason
        };

        workflow.overallStatus = 'rejected';
        workflow.updatedAt = new Date().toISOString();

        const transitionCheck = isValidHouseholdTransition(household.status, HOUSEHOLD_STATUS.REJECTED);
        if (!transitionCheck) {
            return res.status(400).json({
                error: `Impossible de rejeter un ménage avec le statut "${household.status}".`
            });
        }

        await prisma.household.update({
            where: { id: householdId },
            data: {
                constructionData: {
                    ...constructionData,
                    approvalWorkflow: workflow
                },
                status: HOUSEHOLD_STATUS.REJECTED
            }
        });

        await tracerAction({
            userId, organizationId,
            action: 'HOUSEHOLD_STEP_REJECTED',
            resource: 'Ménage', resourceId: householdId,
            details: { role, reason }, req
        });

        res.json(workflow);
    } catch (error) {
        logger.error('Reject step error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Soft-delete a household (archive) — [FIX C-3]
// @route   DELETE /api/households/:id
export const deleteHousehold = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const household = await prisma.household.findFirst({
            where: { id, organizationId, deletedAt: null }
        });

        if (!household) {
            return res.status(404).json({ error: 'Ménage introuvable ou déjà supprimé.' });
        }

        await prisma.household.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // Notifier le SSE pour mise à jour temps réel des cartes
        try {
            eventBus.emit('household:delete', { action: 'delete', id });
        } catch (e) {
            logger.error('EventBus emit deleteHousehold error:', e.message);
        }

        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_MENAGE',
            resource: 'Ménage',
            resourceId: id,
            details: { previousStatus: household.status },
            req
        });

        res.json({ message: 'Ménage archivé avec succès.', id });
    } catch (error) {
        logger.error('Delete household error:', error);
        res.status(500).json({ error: 'Server error while deleting household' });
    }
};

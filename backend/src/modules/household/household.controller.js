import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { logPerformance } from '../../services/performance.service.js';

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
        const { projectId, zoneId, status, bbox, limit = '5000' } = req.query;

        const limitNum = Math.min(parseInt(limit), 10000);

        const where = {
            organizationId,
            deletedAt: null
        };

        if (zoneId) {
            where.zoneId = zoneId;
        } else if (projectId) {
            where.zone = { projectId };
        }

        if (status) {
            where.status = status;
        }

        const households = await prisma.household.findMany({
            where,
            include: {
                zone: {
                    select: { name: true, projectId: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: limitNum
        });

        res.json({ households: sanitizeBigIntForJson(households) });
    } catch (error) {
        console.error('Get households error:', error);
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
        console.error('Get households count error:', error);
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
            where: { id, organizationId, deletedAt: null },
            include: { zone: true }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
        }

        res.json(sanitizeBigIntForJson(household));
    } catch (error) {
        console.error('Get household error:', error);
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
        console.error('Create household error:', error);
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
            where: { id, organizationId, deletedAt: null },
            include: { zone: { select: { projectId: true } } }
        });

        if (!household) {
            return res.status(404).json({ error: 'Household not found' });
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

        res.json(sanitizeBigIntForJson(updated));
    } catch (error) {
        console.error('Update household error:', error);
        res.status(500).json({ error: 'Server error while updating household' });
    }
};

// @desc    Get household by numeroordre
export const getHouseholdByNumero = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { numeroordre } = req.params;

        const household = await prisma.household.findFirst({
            where: { organizationId, numeroordre: String(numeroordre), deletedAt: null },
            include: { zone: { select: { name: true, projectId: true } } }
        });

        if (!household) return res.status(404).json({ error: 'Household not found' });
        res.json({ household: sanitizeBigIntForJson(household) });
    } catch (error) {
        console.error('Get household by numero error:', error);
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
            workflow = {
                householdId: household.id,
                steps: [
                    { role: 'CHEF_PROJET', status: 'pending', label: 'Validation Chef de Projet' },
                    { role: 'ADMIN', status: 'pending', label: 'Validation Administration' },
                    { role: 'DIRECTEUR', status: 'pending', label: 'Approbation Direction' }
                ],
                overallStatus: 'pending',
                createdAt: household.createdAt,
                updatedAt: household.updatedAt
            };
        }

        res.json(workflow);
    } catch (error) {
        console.error('Get approval history error:', error);
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
        let workflow = constructionData.approvalWorkflow || {
            householdId: household.id,
            steps: [
                { role: 'CHEF_PROJET', status: 'pending', label: 'Validation Chef de Projet' },
                { role: 'ADMIN', status: 'pending', label: 'Validation Administration' },
                { role: 'DIRECTEUR', status: 'pending', label: 'Approbation Direction' }
            ],
            overallStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        const stepIndex = workflow.steps.findIndex(s => s.role === role);
        if (stepIndex === -1) return res.status(400).json({ error: 'Role invalid' });

        workflow.steps[stepIndex] = {
            ...workflow.steps[stepIndex],
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date().toISOString(),
            comments: comments
        };

        const allApproved = workflow.steps.every(s => s.status === 'approved');
        workflow.overallStatus = allApproved ? 'approved' : 'in_progress';
        workflow.updatedAt = new Date().toISOString();

        await prisma.household.update({
            where: { id: householdId },
            data: {
                constructionData: {
                    ...constructionData,
                    approvalWorkflow: workflow
                },
                status: allApproved ? 'validated' : household.status
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
        console.error('Approve step error:', error);
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

        if (!workflow) return res.status(400).json({ error: 'No workflow' });

        const stepIndex = workflow.steps.findIndex(s => s.role === role);
        if (stepIndex === -1) return res.status(400).json({ error: 'Role invalid' });

        workflow.steps[stepIndex] = {
            ...workflow.steps[stepIndex],
            status: 'rejected',
            approvedBy: userId,
            approvedAt: new Date().toISOString(),
            comments: reason
        };

        workflow.overallStatus = 'rejected';
        workflow.updatedAt = new Date().toISOString();

        await prisma.household.update({
            where: { id: householdId },
            data: {
                constructionData: {
                    ...constructionData,
                    approvalWorkflow: workflow
                },
                status: 'rejected'
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
        console.error('Reject step error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

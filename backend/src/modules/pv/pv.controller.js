import prisma, { basePrisma } from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

const getUserName = (user) => user?.name || user?.email || 'Système GEM';

export const listPVs = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId, householdId, type } = req.query;

        const where = {
            organizationId,
            deletedAt: null,
            ...(projectId ? { projectId: String(projectId) } : {}),
            ...(householdId ? { householdId: String(householdId) } : {}),
            ...(type ? { type: String(type) } : {})
        };

        const pvs = await prisma.pVRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data: pvs });
    } catch (error) {
        console.error('[PV] list error:', error);
        res.status(500).json({ error: 'Erreur serveur lors du chargement des PV.' });
    }
};

export const upsertPV = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { id, householdId, projectId, type, content, metadata } = req.body;

        if (!householdId || !type) {
            return res.status(400).json({ error: 'householdId et type sont obligatoires.' });
        }

        if (projectId) {
            const project = await prisma.project.findFirst({
                where: { id: projectId, organizationId, deletedAt: null },
                select: { id: true }
            });
            if (!project) {
                return res.status(404).json({ error: 'Projet introuvable pour cette organisation.' });
            }
        }

        const household = await prisma.household.findFirst({
            where: { id: householdId, organizationId, deletedAt: null },
            select: { id: true }
        });

        if (!household) {
            return res.status(404).json({ error: 'Ménage introuvable pour cette organisation.' });
        }

        const pvId = id || `${householdId}_${type}`;
        const createdBy = getUserName(req.user);
        const existingPV = await basePrisma.pVRecord.findFirst({
            where: { id: pvId },
            select: { organizationId: true }
        });

        if (existingPV && existingPV.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Accès interdit à ce PV.' });
        }

        const pv = await prisma.pVRecord.upsert({
            where: { id: pvId },
            create: {
                id: pvId,
                organizationId,
                projectId: projectId || null,
                householdId,
                type,
                content: content || null,
                createdBy,
                metadata: metadata || {}
            },
            update: {
                projectId: projectId || null,
                householdId,
                type,
                content: content || null,
                createdBy,
                metadata: metadata || {},
                deletedAt: null
            }
        });

        await tracerAction({
            userId,
            organizationId,
            action: 'PV_UPSERT',
            resource: 'PVRecord',
            resourceId: pv.id,
            details: { householdId, projectId, type },
            req
        }).catch(() => {});

        res.status(201).json({ data: pv });
    } catch (error) {
        console.error('[PV] upsert error:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la sauvegarde du PV.' });
    }
};

export const deletePV = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { id } = req.params;

        const pv = await prisma.pVRecord.findFirst({
            where: { id, organizationId, deletedAt: null }
        });

        if (!pv) {
            return res.status(404).json({ error: 'PV introuvable.' });
        }

        await prisma.pVRecord.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        await tracerAction({
            userId,
            organizationId,
            action: 'PV_DELETE',
            resource: 'PVRecord',
            resourceId: id,
            details: { householdId: pv.householdId, type: pv.type },
            req
        }).catch(() => {});

        res.json({ success: true });
    } catch (error) {
        console.error('[PV] delete error:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du PV.' });
    }
};

export const resetHouseholdPVs = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { householdId } = req.params;

        const result = await prisma.pVRecord.updateMany({
            where: { organizationId, householdId, deletedAt: null },
            data: { deletedAt: new Date() }
        });

        await tracerAction({
            userId,
            organizationId,
            action: 'PV_RESET_HOUSEHOLD',
            resource: 'PVRecord',
            resourceId: householdId,
            details: { deletedCount: result.count },
            req
        }).catch(() => {});

        res.json({ success: true, deletedCount: result.count });
    } catch (error) {
        console.error('[PV] reset household error:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la remise à zéro des PV.' });
    }
};

export const clearPVs = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const { projectId } = req.query;

        const result = await prisma.pVRecord.updateMany({
            where: {
                organizationId,
                deletedAt: null,
                ...(projectId ? { projectId: String(projectId) } : {})
            },
            data: { deletedAt: new Date() }
        });

        await tracerAction({
            userId,
            organizationId,
            action: 'PV_CLEAR_ARCHIVE',
            resource: 'PVRecord',
            resourceId: projectId || organizationId,
            details: { deletedCount: result.count, projectId: projectId || null },
            req
        }).catch(() => {});

        res.json({ success: true, deletedCount: result.count });
    } catch (error) {
        console.error('[PV] clear error:', error);
        res.status(500).json({ error: 'Erreur serveur lors du vidage des PV.' });
    }
};

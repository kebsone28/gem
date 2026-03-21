import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

/**
 * Optimized Tree Builder
 * Transforms a flat list of teams (with path/parentTeamId) into a hierarchical tree.
 */
const buildTeamTree = (teams) => {
    const map = {};
    const tree = [];

    // First pass: Initialize map and empty children arrays
    teams.forEach(team => {
        map[team.id] = { ...team, children: [] };
    });

    // Second pass: Build hierarchy
    teams.forEach(team => {
        if (team.parentTeamId && map[team.parentTeamId]) {
            map[team.parentTeamId].children.push(map[team.id]);
        } else if (!team.parentTeamId) {
            tree.push(map[team.id]);
        }
    });

    return tree;
};

// @desc    Get all teams for a project (Flat)
// @route   GET /api/teams
export const getTeams = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId, role } = req.query;

        const where = {
            organizationId,
            deletedAt: null
        };

        if (projectId) where.projectId = projectId;
        if (role) where.role = role;

        const teams = await prisma.team.findMany({
            where,
            orderBy: [{ level: 'asc' }, { name: 'asc' }],
            include: {
                leader: { select: { id: true, name: true, email: true } },
                region: true,
                grappe: { select: { id: true, name: true } }
            }
        });

        res.json({ teams });
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Server error while fetching teams' });
    }
};

// @desc    Get teams as a tree structure
// @route   GET /api/teams/tree
export const getTeamsTree = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required for tree view' });
        }

        const teams = await prisma.team.findMany({
            where: {
                projectId,
                organizationId,
                deletedAt: null
            },
            include: {
                leader: { select: { id: true, name: true } },
                region: true,
                grappe: { select: { id: true, name: true } }
            },
            orderBy: { name: 'asc' }
        });

        const tree = buildTeamTree(teams);
        res.json({ tree });
    } catch (error) {
        console.error('Get teams tree error:', error);
        res.status(500).json({ error: 'Server error while building team tree' });
    }
};

// @desc    Create new team (supports hierarchy)
// @route   POST /api/teams
export const createTeam = async (req, res) => {
    try {
        const { name, role, tradeKey, capacity, parentTeamId, projectId, regionId, offlineId } = req.body;
        const { organizationId } = req.user;

        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        let level = 0;
        let parentPath = '';

        if (parentTeamId) {
            const parent = await prisma.team.findUnique({ where: { id: parentTeamId } });
            if (!parent || parent.projectId !== projectId) {
                return res.status(400).json({ error: 'Invalid parent team' });
            }
            level = parent.level + 1;
            parentPath = parent.path;

            if (level > 5) return res.status(400).json({ error: 'Maximum hierarchy depth reached (5)' });
        }

        // 🛡️ PROQUELEC Validation: Region ↔ Grappe Consistency
        if (grappeId && regionId) {
            const grappe = await prisma.grappe.findUnique({ where: { id: grappeId } });
            if (grappe && grappe.regionId !== regionId) {
                return res.status(400).json({ error: "La grappe n'appartient pas à la région sélectionnée" });
            }
        }

        const team = await prisma.team.create({
            data: {
                name,
                role: role || 'INSTALLATION',
                tradeKey,
                capacity: capacity || 0,
                parentTeamId,
                projectId,
                organizationId,
                regionId,
                grappeId,
                offlineId,
                level,
                status: 'active'
            }
        });

        // Update path with own ID
        const finalPath = parentPath ? `${parentPath}/${team.id}` : team.id;
        const updatedTeam = await prisma.team.update({
            where: { id: team.id },
            data: { path: finalPath },
            include: { region: true, grappe: true }
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_EQUIPE',
            resource: 'Équipe',
            resourceId: team.id,
            details: { 
                name, 
                role: updatedTeam.role, 
                region: updatedTeam.region?.name,
                grappe: updatedTeam.grappe?.name
            },
            req
        });

        res.status(201).json(updatedTeam);
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ error: 'Server error while creating team' });
    }
};

// @desc    Update team (handles path recalculation if parent changes)
// @route   PATCH /api/teams/:id
export const updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, tradeKey, capacity, parentTeamId, regionId, grappeId, status } = req.body;
        const { organizationId } = req.user;

        const currentTeam = await prisma.team.findUnique({ 
            where: { id },
            include: { region: true, grappe: true }
        });
        
        if (!currentTeam || currentTeam.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // 🛡️ PROQUELEC Validation: Region ↔ Grappe Consistency
        // Use incoming regionId if present, else fall back to current team's regionId
        const targetRegionId = regionId !== undefined ? regionId : currentTeam.regionId;
        if (grappeId && targetRegionId) {
            const grappe = await prisma.grappe.findUnique({ where: { id: grappeId } });
            if (grappe && grappe.regionId !== targetRegionId) {
                return res.status(400).json({ error: "La grappe n'appartient pas à la région sélectionnée" });
            }
        }

        const data = { name, role, tradeKey, capacity, regionId, grappeId, status };

        // Handle hierarchy move
        if (parentTeamId !== undefined && parentTeamId !== currentTeam.parentTeamId) {
            // ... (hierarchy logic remains same)
            if (parentTeamId === id) return res.status(400).json({ error: 'A team cannot be its own parent' });

            let newLevel = 0;
            let newParentPath = '';

            if (parentTeamId) {
                const newParent = await prisma.team.findUnique({ where: { id: parentTeamId } });
                if (!newParent || newParent.projectId !== currentTeam.projectId) {
                    return res.status(400).json({ error: 'Invalid parent team' });
                }
                if (newParent.path.startsWith(currentTeam.path)) {
                    return res.status(400).json({ error: 'Circular hierarchy detected' });
                }
                newLevel = newParent.level + 1;
                newParentPath = newParent.path;
            }

            data.parentTeamId = parentTeamId;
            data.level = newLevel;
            data.path = newParentPath ? `${newParentPath}/${id}` : id;

            const children = await prisma.team.findMany({
                where: { path: { startsWith: currentTeam.path + '/' } }
            });

            const levelDelta = newLevel - currentTeam.level;
            
            for (const child of children) {
                const updatedChildPath = child.path.replace(currentTeam.path, data.path);
                await prisma.team.update({
                    where: { id: child.id },
                    data: { 
                        path: updatedChildPath,
                        level: child.level + levelDelta
                    }
                });
            }
        }

        const updatedTeam = await prisma.team.update({
            where: { id },
            data,
            include: { region: true, grappe: true }
        });

        // 🧾 PROQUELEC Advanced Audit: Tracking specific changes
        const changes = {};
        if (name && name !== currentTeam.name) changes.name = `${currentTeam.name} -> ${name}`;
        if (regionId !== undefined && regionId !== currentTeam.regionId) {
            const oldRegion = currentTeam.region?.name || 'Aucune';
            const newRegion = (await prisma.region.findUnique({ where: { id: regionId } }))?.name || 'Aucune';
            changes.region = `${oldRegion} -> ${newRegion}`;
        }
        if (grappeId !== undefined && grappeId !== currentTeam.grappeId) {
            const oldGrappe = currentTeam.grappe?.name || 'Aucune';
            const newGrappe = grappeId ? (await prisma.grappe.findUnique({ where: { id: grappeId } }))?.name || 'Inconnue' : 'Aucune';
            changes.grappe = `${oldGrappe} -> ${newGrappe}`;
        }

        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'MISE_A_JOUR_EQUIPE',
            resource: 'Équipe',
            resourceId: id,
            details: { 
                teamName: updatedTeam.name,
                changes: Object.keys(changes).length > 0 ? changes : 'Pas de changement structurel',
                status: updatedTeam.status
            },
            req
        });

        res.json(updatedTeam);
    } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({ error: 'Server error while updating team' });
    }
};

// @desc    Soft Delete team
// @route   DELETE /api/teams/:id
export const deleteTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const team = await prisma.team.findUnique({ where: { id } });
        if (!team || team.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Soft delete the team and all its descendants
        await prisma.team.updateMany({
            where: {
                OR: [
                    { id },
                    { path: { startsWith: team.path + '/' } }
                ]
            },
            data: { deletedAt: new Date() }
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_EQUIPE',
            resource: 'Équipe',
            resourceId: id,
            details: { name: team.name, path: team.path },
            req
        });

        res.json({ message: 'Team and descendants soft-deleted successfully' });
    } catch (error) {
        console.error('Delete team error:', error);
        res.status(500).json({ error: 'Server error while deleting team' });
    }
};

// @desc    Assign team to zone (Legacy support)
export const assignTeamToZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { zoneId } = req.body;
        const { organizationId } = req.user;

        const updatedTeam = await prisma.team.update({
            where: { id, organizationId },
            data: { zoneId }
        });

        res.json({ message: 'Team assigned to zone successfully', team: updatedTeam });
    } catch (error) {
        console.error('Assign team error:', error);
        res.status(500).json({ error: 'Server error while assigning team' });
    }
};

// @desc    Get real-time positions of teams
export const getTeamPositions = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        const teams = await prisma.team.findMany({
            where: { organizationId, projectId, deletedAt: null },
            include: { zone: { select: { name: true } } }
        });

        // Mock positions for now (Real GPS data comes from another service)
        const baseLat = 14.7167;
        const baseLng = -17.4677;

        const positions = teams.map((team) => ({
            id: team.id,
            name: team.name,
            role: team.role,
            zoneName: team.zone?.name || 'Inconnue',
            coordinates: {
                lat: baseLat + (Math.random() - 0.5) * 0.1,
                lng: baseLng + (Math.random() - 0.5) * 0.1
            },
            lastUpdate: new Date()
        }));

        res.json({ positions });
    } catch (error) {
        console.error('Get team positions error:', error);
        res.status(500).json({ error: 'Server error while fetching team positions' });
    }
};


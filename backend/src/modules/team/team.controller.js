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

        console.log(`[TEAMS API] Fetching teams for organizationId: ${organizationId}, projectId: ${projectId}`);

        if (!organizationId) {
            console.error('[TEAMS API] ERROR: organizationId is undefined or null in req.user');
            console.error('[TEAMS API] req.user:', JSON.stringify(req.user));
            return res.status(400).json({ error: 'organizationId missing' });
        }

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

        console.log(`[TEAMS API] Success: found ${teams.length} teams`);
        res.json({ teams });
    } catch (error) {
        console.error('[TEAMS API] ERROR:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            organizationId: req.user?.organizationId
        });
        res.status(500).json({ error: 'Server error while fetching teams', details: error.message });
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
        const { name, role, tradeKey, capacity, parentTeamId, projectId, regionId, grappeId, offlineId } = req.body;
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
        res.status(500).json({ error: 'Server error while creating team', message: error.message });
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

// @desc    Assign team to zone (Legacy) or grappe
export const assignTeamToZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { zoneId, grappeId } = req.body;
        const { organizationId } = req.user;

        const data = {};
        if (zoneId !== undefined) data.zoneId = zoneId;
        if (grappeId !== undefined) data.grappeId = grappeId;

        const updatedTeam = await prisma.team.update({
            where: { id, organizationId },
            data
        });

        res.json({ message: 'Team assigned successfully', team: updatedTeam });
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

// @desc    Auto-generate teams based on regions and households
// @route   POST /api/teams/auto-generate
export const autoGenerateTeams = async (req, res) => {
    try {
        const { projectId, durationMonths, productionRates } = req.body;
        const { organizationId } = req.user;

        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const targetMonths = Math.max(1, Number(durationMonths) || 6);

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId, deletedAt: null }
        });

        if (!project) {
            return res.status(404).json({ error: 'Projet introuvable.' });
        }

        // 1. Fetch all households for the project to calculate needs
        const households = await prisma.household.findMany({
            where: {
                organizationId,
                deletedAt: null,
                OR: [
                    { zone: { is: { projectId } } },
                    { zoneId: null }
                ]
            }
        });

        if (households.length === 0) {
            return res.status(400).json({ error: 'Aucun ménage disponible pour ce projet.' });
        }

        // 2. Fetch regions
        const regions = await prisma.region.findMany();

        const workingDays = targetMonths * 22;
        const rates = productionRates || { macons: 5, reseau: 8, interieur_type1: 6, controle: 15, livraison: 12 };

        const AUTO_TEAM_BLUEPRINTS = [
            { key: 'livraison', role: 'LOGISTICS', label: 'Logistique', tradeKey: 'livraison' },
            { key: 'macons', role: 'INSTALLATION', label: 'Maçonnerie', tradeKey: 'macons' },
            { key: 'reseau', role: 'INSTALLATION', label: 'Réseau', tradeKey: 'reseau' },
            { key: 'interieur_type1', role: 'INSTALLATION', label: 'Installations intérieures', tradeKey: 'interieur_type1' },
            { key: 'controle', role: 'SUPERVISION', label: 'Contrôle', tradeKey: 'controle' },
        ];

        // Prepare regions stats
        const householdsByRegion = {};
        households.forEach(h => {
                    if (!h.region) return;
                    const normalizedRegion = h.region.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                    householdsByRegion[normalizedRegion] = (householdsByRegion[normalizedRegion] || 0) + 1;
        });

        const regionLookup = {};
        regions.forEach(r => {
            const normalizedRegion = r.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
            regionLookup[normalizedRegion] = r.id;
        });

        let totalTeamsCreated = 0;

        // 3. Prisma Transaction: Delete old teams and insert new ones
        const transactionResult = await prisma.$transaction(async (tx) => {
            // Delete old teams
            await tx.team.deleteMany({
                where: { projectId, organizationId }
            });

            const nextRegionsConfig = {};
            const generatedTeamSnapshots = [];

            // Generate teams per region
            for (const [normalizedRegion, count] of Object.entries(householdsByRegion)) {
                const regionId = regionLookup[normalizedRegion];
                const originalRegionName = households.find(h => h.region?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === normalizedRegion)?.region;

                // Create Parent Team
                const parentTeam = await tx.team.create({
                    data: {
                        name: `Cellule ${originalRegionName}`,
                        role: 'INSTALLATION',
                        projectId,
                        organizationId,
                        regionId: regionId || null,
                        capacity: 0,
                        level: 0,
                        status: 'active'
                    }
                });

                // Update Path
                await tx.team.update({
                    where: { id: parentTeam.id },
                    data: { path: parentTeam.id }
                });

                const generatedChildren = [];

                for (const blueprint of AUTO_TEAM_BLUEPRINTS) {
                    const rate = rates[blueprint.tradeKey] || 1;
                    const requiredTeams = Math.ceil(count / (workingDays * rate));

                    for (let i = 0; i < requiredTeams; i++) {
                        const child = await tx.team.create({
                            data: {
                                name: `${blueprint.label} ${i + 1} - ${originalRegionName}`,
                                role: blueprint.role,
                                tradeKey: blueprint.tradeKey,
                                parentTeamId: parentTeam.id,
                                projectId,
                                organizationId,
                                regionId: regionId || null,
                                capacity: Math.max(1, Math.round(rate)),
                                level: 1,
                                status: 'active',
                                path: `${parentTeam.id}/temp` // Placeholder, will update later if needed
                            }
                        });

                        await tx.team.update({
                            where: { id: child.id },
                            data: { path: `${parentTeam.id}/${child.id}` }
                        });

                        generatedChildren.push(child);
                        totalTeamsCreated++;
                    }
                }

                generatedTeamSnapshots.push({
                    id: parentTeam.id,
                    name: parentTeam.name,
                    role: parentTeam.role,
                    regionId: parentTeam.regionId,
                    subTeams: generatedChildren.map(c => ({
                        id: c.id,
                        name: c.name,
                        role: c.role,
                        tradeKey: c.tradeKey,
                        regionId: c.regionId,
                        capacity: c.capacity
                    }))
                });

                nextRegionsConfig[originalRegionName] = {
                    autoGenerated: true,
                    planningWindowMonths: targetMonths,
                    householdCount: count,
                    teamAllocations: generatedChildren.map((child, index) => ({
                        id: `alloc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                        subTeamId: child.id,
                        priority: index + 1
                    }))
                };
            }

            return { nextRegionsConfig, generatedTeamSnapshots };
        }, { timeout: 30000 }); // Increase timeout for massive generation

        const currentConfig = project.config || {};
        
        await prisma.project.update({
            where: { id: projectId },
            data: {
                duration: targetMonths,
                config: {
                    ...currentConfig,
                    teams: transactionResult.generatedTeamSnapshots,
                    regionsConfig: {
                        ...(currentConfig.regionsConfig || {}),
                        ...transactionResult.nextRegionsConfig
                    }
                }
            }
        });

        // 4. Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'REGENERATION_AUTOMATIQUE_EQUIPES',
            resource: 'Projet',
            resourceId: projectId,
            details: {
                message: `${totalTeamsCreated} équipes générées automatiquement. Anciennes équipes écrasées.`,
                durationMonths: targetMonths,
                productionRates
            },
            req
        });

        res.status(200).json({ 
            message: 'Équipes générées avec succès', 
            totalTeamsCreated,
            durationMonths: targetMonths
        });

    } catch (error) {
        console.error('Auto Generate Teams error:', error);
        res.status(500).json({ error: 'Erreur lors de la génération automatique des équipes', details: error.message });
    }
};


import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { socketService } from '../../services/socket.service.js';

// @desc    Get all projects for an organization
// @route   GET /api/projects
export const getProjects = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const projects = await prisma.project.findMany({
            where: {
                organizationId,
                deletedAt: null
            },
            include: {
                updatedBy: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        res.json({ projects });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Server error while fetching projects' });
    }
};

// @desc    Get single project
// @route   GET /api/projects/:id
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const project = await prisma.project.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null
            },
            include: {
                updatedBy: {
                    select: {
                        name: true
                    }
                },
                zones: {
                    where: { deletedAt: null }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Server error while fetching project' });
    }
};

// @desc    Create new project
// @route   POST /api/projects
export const createProject = async (req, res) => {
    try {
        const { id, name, budget, duration, totalHouses, config } = req.body;
        const { organizationId, id: userId } = req.user;

        const project = await prisma.project.create({
            data: {
                id: id || undefined, // Use client-provided ID or let Prisma generate one
                name,
                status: 'active',
                budget: budget || 0,
                duration: duration || 12,
                totalHouses: totalHouses || 0,
                config: config || {},
                organizationId,
                updatedById: userId
            }
        });

        // Audit Log
        await tracerAction({
            userId,
            organizationId,
            action: 'CREATION_PROJET',
            resource: 'Projet',
            resourceId: project.id,
            details: { name: project.name },
            req
        });

        res.status(201).json(project);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Server error while creating project' });
    }
};

// @desc    Update project
// @route   PATCH /api/projects/:id
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, budget, duration, totalHouses, config } = req.body;
        const { organizationId, id: userId } = req.user;

        const project = await prisma.project.findFirst({
            where: { id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const updatedProject = await prisma.project.update({
            where: { id },
            data: {
                name,
                status,
                budget,
                duration,
                totalHouses,
                config,
                updatedById: userId,
                version: project.version + 1
            }
        });

        // Audit Log
        await tracerAction({
            userId,
            organizationId,
            action: 'MODIFICATION_PROJET',
            resource: 'Projet',
            resourceId: id,
            details: {
                old: { name: project.name, status: project.status },
                new: { name, status }
            },
            req
        });

        // 🟢 NEW: Emit websocket event to notify all clients
        try {
            socketService.emit('notification', {
                type: 'SYNC',
                message: `La configuration du projet a été mise à jour`,
                data: { user: userId, action: 'PROJECT_UPDATED', id }
            });
        } catch (wsError) {
             console.error('WebSocket Emit error during project update:', wsError);
        }

        res.json(updatedProject);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Server error while updating project' });
    }
};

// @desc    Delete project (Soft delete) — requires admin password confirmation
// @route   DELETE /api/projects/:id
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const { organizationId } = req.user;

        // 1. Require password in request body
        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis pour supprimer un projet.' });
        }

        // 2. Fetch current user with their passwordHash
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!currentUser) {
            return res.status(403).json({ error: 'Utilisateur introuvable.' });
        }

        // 3. Verify password against DB hash
        const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
        if (!isPasswordValid) {
            return res.status(403).json({ error: 'Mot de passe incorrect. Suppression refusée.' });
        }

        // 4. Find project
        const project = await prisma.project.findFirst({
            where: { id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // 5. Soft delete
        await prisma.project.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // 6. Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_PROJET',
            resource: 'Projet',
            resourceId: id,
            details: { name: project.name },
            req
        });

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error while deleting project' });
    }
};

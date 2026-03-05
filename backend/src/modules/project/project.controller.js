import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

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
        const { name, budget, duration, totalHouses, config } = req.body;
        const { organizationId, id: userId } = req.user;

        const project = await prisma.project.create({
            data: {
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

        res.json(updatedProject);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Server error while updating project' });
    }
};

// @desc    Delete project (Soft delete)
// @route   DELETE /api/projects/:id
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const project = await prisma.project.findFirst({
            where: { id, organizationId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        await prisma.project.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // Audit Log
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

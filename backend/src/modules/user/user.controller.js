import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all users for an organization
// @route   GET /api/users
export const getUsers = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const users = await prisma.user.findMany({
            where: { organizationId },
            include: { 
                ledTeam: true,
                role: true 
            },
            orderBy: { createdAt: 'desc' }
        });

        // Supprimer les hashs des réponses pour la sécurité
        const safeUsers = users.map(u => {
            const { passwordHash, securityAnswerHash, recoveryCodeHash, ...rest } = u;
            // On reconstruit le champ role pour le Frontend pour assurer la compatibilité
            return {
                ...rest,
                role: u.role?.name || u.roleLegacy || 'CHEF_EQUIPE'
            };
        });

        res.json({ users: safeUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error while fetching users' });
    }
};

// @desc    Create a new user
// @route   POST /api/users
export const createUser = async (req, res) => {
    try {
        const { email, notificationEmail, password, name, roleId, role, requires2FA, teamId, permissions } = req.body;
        const { organizationId } = req.user;

        // 1. Check if user already exists
        const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (userExists) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        // 1.5 Find Role ID by name if provided (Support RBAC mapping)
        let finalRoleId = roleId;
        if (!finalRoleId && role) {
            const roleObj = await prisma.role.findFirst({ where: { name: role } });
            if (roleObj) finalRoleId = roleObj.id;
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                notificationEmail: notificationEmail || undefined,
                passwordHash,
                name,
                roleLegacy: role || 'CHEF_EQUIPE',
                roleId: finalRoleId,
                requires2FA: !!requires2FA,
                permissions: permissions || [],
                organizationId
            },
            include: { role: true }
        });

        // 4. Link to team if provided
        if (teamId && user.roleLegacy === 'CHEF_EQUIPE') {
            await prisma.team.update({
                where: { id: teamId },
                data: { leaderId: user.id }
            });
        }

        // 5. Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_UTILISATEUR',
            resource: 'Utilisateur',
            resourceId: user.id,
            details: { email: user.email, role: user.roleLegacy },
            req
        });

        const { passwordHash: _, ...safeUser } = user;
        res.json({ ...safeUser, role: user.role?.name || user.roleLegacy });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Server error while creating user' });
    }
};

// @desc    Update a user
// @route   PATCH /api/users/:id
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, notificationEmail, role, roleId, teamId, active, requires2FA, password, permissions } = req.body;
        const { organizationId } = req.user;

        // 1. Check if user exists
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user || user.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const before = { name: user.name, email: user.email, role: user.roleLegacy };

        // 1.5 Find Role ID by name if provided (Support RBAC mapping)
        let finalRoleId = roleId;
        if (role && !finalRoleId) {
            const roleObj = await prisma.role.findFirst({ where: { name: role } });
            if (roleObj) finalRoleId = roleObj.id;
        }

        // 2. Hash new password if provided
        let passwordHash = undefined;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(password, salt);
        }

        // 3. Update user
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name,
                email: email ? email.toLowerCase() : undefined,
                notificationEmail,
                roleLegacy: role,
                roleId: finalRoleId,
                active,
                requires2FA,
                passwordHash,
                permissions
            },
            include: { role: true }
        });

        // 4. Update team lead if needed
        if (teamId !== undefined) {
             // Si c'était un chef d'équipe, on retire l'ancien lien
             await prisma.team.updateMany({
                 where: { leaderId: updatedUser.id },
                 data: { leaderId: null }
             });
             
             if (teamId) {
                 await prisma.team.update({
                     where: { id: teamId },
                     data: { leaderId: updatedUser.id }
                 });
             }
        }

        // 5. Audit Log (Maintenu avec await pour la fiabilité post-refresh)
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'MISE_A_JOUR_UTILISATEUR',
            resource: 'Utilisateur',
            resourceId: updatedUser.id,
            details: { 
                before, 
                after: { name: updatedUser.name, email: updatedUser.email, role: updatedUser.roleLegacy },
                passUpdate: !!password
            },
            req
        });

        const { passwordHash: _, ...safeUser } = updatedUser;
        res.json({ ...safeUser, role: updatedUser.role?.name || updatedUser.roleLegacy });

    } catch (error) {
        console.error('Update user error:', error);
        
        // Handling specific Prisma errors to provide better feedback to the frontend
        if (error.code === 'P2002') {
            return res.status(400).json({ 
                error: 'Cet email est déjà utilisé par un autre compte',
                code: 'EMAIL_ALREADY_EXISTS'
            });
        }
        
        if (error.code === 'P2025') {
            return res.status(404).json({ 
                error: 'Utilisateur non trouvé ou accès refusé (périmètre organisation)',
                code: 'USER_NOT_FOUND'
            });
        }

        res.status(500).json({ error: 'Server error while updating user' });
    }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user || user.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        if (req.user.id === id) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        await prisma.user.delete({ where: { id } });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'SUPPRESSION_UTILISATEUR',
            resource: 'Utilisateur',
            resourceId: id,
            details: { email: user.email },
            req
        });

        res.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Server error while deleting user' });
    }
};

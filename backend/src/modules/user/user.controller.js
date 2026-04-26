import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { hasPrismaDelegate } from '../../core/utils/prismaCompat.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Normalise les valeurs optionnelles pour Prisma (chaîne vide -> null)
 */
const cleanNullable = (val) => (val === "" || val === undefined ? null : val);

// @desc    Get all users for an organization
// @route   GET /api/users
export const getUsers = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const users = await prisma.user.findMany({
            where: { organizationId },
            include: { ledTeam: true, role: true },
            orderBy: { createdAt: 'desc' }
        });

        const safeUsers = users.map(u => {
            const { passwordHash, securityAnswerHash, recoveryCodeHash, ...rest } = u;
            return { ...rest, role: u.role?.name || u.roleLegacy || 'CHEF_EQUIPE' };
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

        const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (userExists) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        let finalRoleId = cleanNullable(roleId);
        if (!finalRoleId && role) {
            const roleObj = await prisma.role.findFirst({ where: { name: role } });
            if (roleObj) finalRoleId = roleObj.id;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                notificationEmail: cleanNullable(notificationEmail),
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

        const cleanedTeamId = cleanNullable(teamId);
        if (cleanedTeamId && user.roleLegacy === 'CHEF_EQUIPE') {
            await prisma.team.updateMany({
                where: { id: cleanedTeamId, organizationId },
                data: { leaderId: user.id }
            });
        }

        try {
            await tracerAction({
                userId: req.user.id, organizationId,
                action: 'CREATION_UTILISATEUR', resource: 'Utilisateur', resourceId: user.id,
                details: { email: user.email, role: user.roleLegacy }, req
            });
        } catch (e) { console.warn('[AUDIT] Create user log failed:', e.message); }

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

        console.log('[UPDATE_USER] Request body:', req.body);
        console.log('[UPDATE_USER] User ID:', id);
        console.log('[UPDATE_USER] Authenticated User Organization ID:', organizationId);

        // 1. Ownership Validation
        const user = await prisma.user.findFirst({ where: { id, organizationId } });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé ou accès refusé' });
        }

        const before = { name: user.name, email: user.email, role: user.roleLegacy };

        // 2. Email duplicate check
        if (email !== undefined && email.toLowerCase() !== user.email.toLowerCase()) {
            const existing = await prisma.user.findFirst({
                where: { email: email.toLowerCase(), NOT: { id } }
            });
            if (existing) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte' });
            }
        }

        // 3. Resolve Role
        let finalRoleId = roleId !== undefined ? cleanNullable(roleId) : undefined;
        if (finalRoleId === null && role && role !== user.roleLegacy) {
            // If clearing roleId but setting a legacy role, try to find matching RBAC role
        } else if (role && !finalRoleId && roleId === undefined) {
            const roleObj = await prisma.role.findFirst({ where: { name: role } });
            if (roleObj) finalRoleId = roleObj.id;
        }

        // 4. Hash new password if provided
        let passwordHash = undefined;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(password, salt);
        }

        // 5. Build updateData (only send defined fields)
        const updateData = {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email: email.toLowerCase() }),
            ...(notificationEmail !== undefined && { notificationEmail: cleanNullable(notificationEmail) }),
            ...(role !== undefined && { roleLegacy: role }),
            ...(roleId !== undefined && { roleId: cleanNullable(roleId) }),
            ...(active !== undefined && { active }),
            ...(requires2FA !== undefined && { requires2FA }),
            ...(passwordHash !== undefined && { passwordHash }),
            ...(permissions !== undefined && { permissions }),
        };

        // 6. Update via updateMany (supports organizationId filter without needing composite unique index)
        const updateResult = await prisma.user.updateMany({
            where: { id, organizationId },
            data: updateData
        });

        if (updateResult.count === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé ou mise à jour refusée' });
        }

        // 7. Re-fetch updated user
        const updatedUser = await prisma.user.findUnique({
            where: { id },
            include: { role: true }
        });

        // 8. Update team lead if needed
        if (teamId !== undefined) {
            const cleanedTeamId = cleanNullable(teamId);

            // Remove old team lead assignment
            await prisma.team.updateMany({
                where: { leaderId: updatedUser.id, organizationId },
                data: { leaderId: null }
            });

            if (cleanedTeamId) {
                const teamExists = await prisma.team.findFirst({
                    where: { id: cleanedTeamId, organizationId }
                });
                if (teamExists) {
                    await prisma.team.updateMany({
                        where: { id: cleanedTeamId, organizationId },
                        data: { leaderId: updatedUser.id }
                    });
                }
            }
        }

        // 9. Audit Log (non-blocking)
        try {
            await tracerAction({
                userId: req.user.id, organizationId,
                action: 'MISE_A_JOUR_UTILISATEUR', resource: 'Utilisateur', resourceId: updatedUser.id,
                details: {
                    before,
                    after: { name: updatedUser.name, email: updatedUser.email, role: updatedUser.roleLegacy },
                    passUpdate: !!password
                },
                req
            });
        } catch (e) { console.warn('[AUDIT] Update user log failed:', e.message); }

        const { passwordHash: _, ...safeUser } = updatedUser;
        res.json({ ...safeUser, role: updatedUser.role?.name || updatedUser.roleLegacy });

    } catch (error) {
        console.error('[USER_UPDATE_ERROR]', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la mise à jour',
            code: 'USER_UPDATE_FAILED',
            ...(isDev && { details: error.message, stack: error.stack })
        });
    }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const user = await prisma.user.findFirst({ where: { id, organizationId } });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        if (req.user.id === id) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        if (user.roleLegacy === 'ADMIN_PROQUELEC') {
            return res.status(400).json({ error: 'Impossible de supprimer un compte Administrateur.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.team.updateMany({
                where: { organizationId, leaderId: id },
                data: { leaderId: null }
            });

            await tx.project.updateMany({
                where: { organizationId, updatedById: id },
                data: { updatedById: null }
            });

            await tx.mission.updateMany({
                where: { organizationId, createdBy: id },
                data: { createdBy: null }
            });

            if (hasPrismaDelegate(tx, 'chatConversation')) {
                await tx.chatConversation.updateMany({
                    where: { organizationId, createdById: id },
                    data: { createdById: null }
                });
            }

            await tx.actionApproval.updateMany({
                where: { organizationId, userId: id },
                data: { userId: null }
            });

            await tx.auditLog.deleteMany({
                where: { organizationId, userId: id }
            });

            await tx.performanceLog.deleteMany({
                where: { organizationId, userId: id }
            });

            if (hasPrismaDelegate(tx, 'syncLog')) {
                await tx.syncLog.deleteMany({
                    where: { organizationId, userId: id }
                });
            }

            if (hasPrismaDelegate(tx, 'userMemory')) {
                await tx.userMemory.deleteMany({
                    where: { userId: id }
                });
            }

            await tx.user.delete({ where: { id } });
        });

        try {
            await tracerAction({
                userId: req.user.id, organizationId,
                action: 'SUPPRESSION_UTILISATEUR', resource: 'Utilisateur', resourceId: id,
                details: { email: user.email }, req
            });
        } catch (e) { console.warn('[AUDIT] Delete user log failed:', e.message); }

        res.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            error: 'Server error while deleting user',
            ...(isDev && { details: error.message, code: error.code })
        });
    }
};

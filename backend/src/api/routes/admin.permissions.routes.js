import express from 'express';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import prisma from '../../core/utils/prisma.js';

const router = express.Router();

// All admin permission routes require authentication
router.use(authProtect);

// Only user managers may edit role permissions
router.get('/role-permissions', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: { permission: true }
                }
            }
        });

        const result = roles.map(r => ({
            role: r.name,
            permissions: (r.permissions || []).map(p => p.permission.key)
        }));

        // Also return canonical permission list
        const allPermissions = await prisma.permission.findMany();
        const keys = allPermissions.map(p => p.key);

        return res.json({ ok: true, roles: result, permissions: keys });
    } catch (err) {
        console.error('Failed to fetch role-permissions', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Export current matrix as JSON
router.get('/role-permissions/export', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { permissions: { include: { permission: true } } }
        });
        const result = roles.map(r => ({ role: r.name, permissions: (r.permissions || []).map(p => p.permission.key) }));
        return res.json({ ok: true, exportedAt: new Date().toISOString(), roles: result });
    } catch (err) {
        console.error('Failed to export role-permissions', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Update permissions for a single role (replace set)
router.post('/role-permissions/:role', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
    const roleName = req.params.role;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array of keys' });
    }

    try {
        const role = await prisma.role.findFirst({ where: { name: { equals: roleName, mode: 'insensitive' } } });
        if (!role) return res.status(404).json({ error: 'Role not found' });

        // Ensure permission records exist for provided keys
        const existing = await prisma.permission.findMany({ where: { key: { in: permissions } } });
        const existingKeys = existing.map(p => p.key);
        const missing = permissions.filter(p => !existingKeys.includes(p));

        if (missing.length > 0) {
            // create missing permission records (Prisma schema requires `label`)
            await prisma.permission.createMany({ data: missing.map(k => ({ key: k, label: k })), skipDuplicates: true });
        }

        const perms = await prisma.permission.findMany({ where: { key: { in: permissions } } });

        // Transaction: remove existing role-permissions and create new ones
        await prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
            if (perms.length > 0) {
                const data = perms.map(p => ({ roleId: role.id, permissionId: p.id }));
                await tx.rolePermission.createMany({ data, skipDuplicates: true });
            }
        });

        return res.json({ ok: true, role: role.name, permissions });
    } catch (err) {
        console.error('Failed to update role-permissions', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Import a full matrix JSON: { roles: [{ role: 'NAME', permissions: ['p1','p2'] }, ...] }
router.post('/role-permissions/import', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.roles)) {
        return res.status(400).json({ error: 'Invalid payload: expected { roles: [{ role, permissions: [] }] }' });
    }

    try {
        // Collect all permissions keys and ensure they exist
        const allKeys = Array.from(new Set(payload.roles.flatMap(r => Array.isArray(r.permissions) ? r.permissions : [])));
        const existing = await prisma.permission.findMany({ where: { key: { in: allKeys } } });
        const existingKeys = existing.map(p => p.key);
        const missing = allKeys.filter(k => !existingKeys.includes(k));

        if (missing.length > 0) {
            await prisma.permission.createMany({ data: missing.map(k => ({ key: k, label: k })), skipDuplicates: true });
        }

        // For each role, ensure role exists and replace its permissions
        await prisma.$transaction(async (tx) => {
            for (const r of payload.roles) {
                if (!r.role) continue;
                let role = await tx.role.findFirst({ where: { name: { equals: r.role, mode: 'insensitive' } } });
                if (!role) {
                    role = await tx.role.create({ data: { name: r.role } });
                }

                const perms = Array.isArray(r.permissions) ? r.permissions : [];
                const permsRecords = await tx.permission.findMany({ where: { key: { in: perms } } });

                await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
                if (permsRecords.length > 0) {
                    const data = permsRecords.map(p => ({ roleId: role.id, permissionId: p.id }));
                    await tx.rolePermission.createMany({ data, skipDuplicates: true });
                }
            }
        });

        return res.json({ ok: true, importedAt: new Date().toISOString(), rolesImported: payload.roles.length });
    } catch (err) {
        console.error('Failed to import role-permissions', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

export default router;

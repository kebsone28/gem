import express from 'express';
import { authProtect } from '../middlewares/auth.js';
import { ROLE_PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// Protected debug endpoint to inspect the server-evaluated user object
router.get('/whoami', authProtect, (req, res) => {
    // Don't expose sensitive token fields if present
    const safeUser = { ...req.user };
    delete safeUser.iat;
    delete safeUser.exp;
    delete safeUser.jti;

    const normalizedRole = (safeUser.role || '').toUpperCase();
    const rolePerms = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS[safeUser.role] || [];

    // If permissionsWereManuallySet (empty array included) then token permissions are authoritative
    const tokenPermissions = Array.isArray(safeUser.permissions) ? safeUser.permissions : [];
    const permissionsWasManuallySet = !!req.user.permissionsWasManuallySet;

    const effectivePermissions = permissionsWasManuallySet
        ? tokenPermissions
        : Array.from(new Set([...(rolePerms || []), ...tokenPermissions]));

    return res.json({
        ok: true,
        user: safeUser,
        rolePermissions: rolePerms,
        tokenPermissions,
        permissionsWasManuallySet,
        effectivePermissions
    });
});

export default router;

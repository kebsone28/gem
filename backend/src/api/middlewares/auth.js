import { verifyAccessToken } from '../../core/utils/jwt.js';
import logger from '../../utils/logger.js';
import { runWithContext } from '../../core/context/storage.js';
import { normalizeRole } from '../../core/utils/roles.js';
import { verifierProjet } from '../../middleware/verifierPermission.js';
import { routePermissionSatisfied } from '../../core/config/permissionNormalization.js';
import { ROLE_PERMISSIONS } from '../../core/config/permissions.js';

/** Chaîne de permission (legacy snake_case ou jeton namespacé minuscule). */
const looksLikePermissionKey = (s) =>
  typeof s === 'string' && s === s.toLowerCase() && (s.includes('_') || s.includes('.'));

export const authProtect = async (req, res, next) => {
    try {
        let token;
        const endpoint = req.path || req.url;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer')) {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            logger.warn(`[AUTH-401] No token provided. Endpoint: ${endpoint}. Header Present: ${!!authHeader}`);
            return res.status(401).json({
                error: 'Not authorized, no token',
                code: 'NO_TOKEN'
            });
        }

        // Check if token is a string "undefined" or "null" (safety net for storage issues)
        if (token === 'undefined' || token === 'null' || token.length < 20) {
            logger.error(`[AUTH-401] Malformed or corrupt token string: "${token.substring(0, 20)}..."`);
            return res.status(401).json({
                error: 'Malformed session token',
                code: 'MALFORMED_TOKEN'
            });
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);

            // Critical Payload Validation
            if (!decoded.id || !decoded.organizationId) {
                logger.error(`[AUTH-401] Incomplete Token Payload: id=${decoded.id}, org=${decoded.organizationId}`);
                return res.status(401).json({
                    error: 'Invalid session payload',
                    code: 'INCOMPLETE_PAYLOAD'
                });
            }
        } catch (jwtError) {
            const isExpired = jwtError.name === 'TokenExpiredError';
            logger.error(`[AUTH-401] Token verification failed: ${jwtError.message}. Reason: ${isExpired ? 'EXPIRED' : 'INVALID'}. Endpoint: ${endpoint}`);

            return res.status(401).json({
                error: 'Not authorized, token failed',
                reason: isExpired ? 'expired' : 'invalid',
                code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
            });
        }

        // Debug log: reveal whether token carries permissions and how we interpret them
        try {
            logger.info(`[AUTH] Token decoded: id=${decoded.id} org=${decoded.organizationId} role=${decoded.role} permissionsPresent=${Array.isArray(decoded.permissions)} permissionsCount=${(Array.isArray(decoded.permissions) && decoded.permissions.length) || 0}`);
        } catch (e) {
            // best-effort logging
            logger.debug('[AUTH] Token decoded but logging failed', e?.message || e);
        }

        // Inject user info into request object
        req.user = {
            ...decoded,
            organizationId: decoded.organizationId,
            permissions: decoded.permissions || [],
            // Consider an explicit empty array as a manual override (admin intentionally removed permissions)
            permissionsWasManuallySet: Array.isArray(decoded.permissions)
        };

        // 🚀 CRITICAL: Run entire request chain within async context for Prisma multi-tenant filtering.
        return runWithContext({
            userId: decoded.id,
            organizationId: decoded.organizationId,
            projectId: req.headers['x-project-id'] || null,
            role: decoded.role
        }, async () => {
            // 🛡️ [QUAL qual_006] Selective project verification
            // Avoid calling verifierProjet for global routes to prevent breakage if header is stale.
            const projectScopedPrefixes = ['/api/projects', '/api/missions', '/api/teams', '/api/finance', '/api/planning', '/api/logistics', '/api/inventory', '/api/grappes', '/api/pv'];
            const isProjectRoute = projectScopedPrefixes.some(prefix => req.originalUrl.startsWith(prefix));
            
            if (isProjectRoute) {
                await verifierProjet(req, res, next);
            } else {
                return next();
            }
        });

    } catch (error) {
        logger.error('[AUTH-CRITICAL] Unexpected error in auth middleware:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};

export const authorize = (...args) => {
    let requiredPermission = null;
    let authorizedRoles = [];

    if (args.length === 1 && Array.isArray(args[0])) {
        authorizedRoles = args[0];
    } else if (args.length >= 1) {
        const firstArg = args[0];
        const rest = args.slice(1);
        const hasRoleArray = rest.length === 1 && Array.isArray(rest[0]);
        const roleSlice = hasRoleArray ? rest[0] : rest;

        if (looksLikePermissionKey(firstArg)) {
            requiredPermission = firstArg;
            authorizedRoles = roleSlice;
        } else {
            authorizedRoles = args.flat();
        }
    }

    return (req, res, next) => {
        const rawUserRole = req.user.role?.toUpperCase();
        const userRole = normalizeRole(rawUserRole);
        const isAdmin =
            userRole === 'ADMIN_PROQUELEC';

        const normalizedAuthorizedRoles = authorizedRoles.map((r) => normalizeRole(r));
        const roleMatches =
            normalizedAuthorizedRoles.length === 0 ||
            normalizedAuthorizedRoles.includes(userRole);

        const permOk =
            !!requiredPermission &&
            routePermissionSatisfied(
                req.user.permissions || [],
                req.user.role,
                requiredPermission,
                ROLE_PERMISSIONS
            );

        if (isAdmin || (requiredPermission ? permOk : roleMatches)) {
            return next();
        }

        logger.warn(
            `[AUTH] 🚫 RBAC DENIED: User Role '${rawUserRole}' (→${userRole}) not in [${authorizedRoles.join(', ')}] requiredPerm=${requiredPermission || 'none'}`
        );
        return res.status(403).json({
            error: 'Access denied: insufficient permissions',
            details: { userRole, requiredRoles: authorizedRoles, requiredPermission }
        });
    };
};

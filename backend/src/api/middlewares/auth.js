import { verifyAccessToken } from '../../core/utils/jwt.js';
import logger from '../../utils/logger.js';

export const authProtect = async (req, res, next) => {
    try {
        let token;
        
        // DEBUG: Log auth header at sync endpoint
        const endpoint = req.path || req.url;
        
        // 🔒 SECURITY: Debug logs removed for production - tokens no longer exposed

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            logger.error(`[AUTH-ERROR] No token available. Endpoint: ${endpoint}. Headers:`, Object.keys(req.headers));
            return res.status(401).json({ error: 'Not authorized, no token' });
        }

        const decoded = verifyAccessToken(token);
        
        // Log decoded role and permissions for debugging
        logger.info(`[AUTH] 👤 User: ${decoded.email} | Role: ${decoded.role} | Perms: ${JSON.stringify(decoded.permissions)}`);

        // Inject user info into request
        req.user = {
            ...decoded,
            organizationId: decoded.organizationId, // Critical for Prisma $extends multi-tenancy
            permissions: decoded.permissions || [],
            // Flag to detect if Admin has touched this profile
            permissionsWasManuallySet: decoded.permissions !== null && decoded.permissions !== undefined
        };

        next();
    } catch (error) {
        logger.error('Auth check failed:', error.message);
        res.status(401).json({ error: 'Not authorized, token failed' });
    }
};

export const authorize = (...args) => {
    // Si on reçoit plusieurs arguments et le premier n'est pas un tableau, 
    // on traite tout comme une liste de rôles.
    let requiredPermission = null;
    let authorizedRoles = [];

    if (args.length === 1 && Array.isArray(args[0])) {
        authorizedRoles = args[0];
    } else if (args.length >= 1) {
        // Est-ce que le premier argument ressemble à une permission (minuscules avec underscore ?)
        const firstArg = args[0];
        if (typeof firstArg === 'string' && (firstArg.includes('_') && firstArg === firstArg.toLowerCase())) {
            requiredPermission = firstArg;
            authorizedRoles = Array.isArray(args[1]) ? args[1] : args.slice(1);
        } else {
            // Tout est considéré comme des rôles
            authorizedRoles = args.flat();
        }
    }

    return (req, res, next) => {
        const userRole = req.user.role?.toUpperCase();
        const emailStr = req.user.email?.toLowerCase() || "";

        // 1. SYSTEM ADMIN BYPASS (God Mode)
        // Hardcoded to strictly match role or specific admin/dg email
        const isAdmin = userRole === 'ADMIN_PROQUELEC' || 
                        userRole === 'ADMIN' || 
                        emailStr === 'admin@proquelec.com' ||
                        emailStr === 'dg@proquelec.com';

        // 2. GRANULAR PERMISSION CHECK
        // If the user has custom permissions (manually set by Admin), we check it strictly.
        // Even an empty array [ ] means "Forbidden to everything"
        const hasExplicitPermissionsSet = req.user.permissionsWasManuallySet;
        const hasExplicitAllow = requiredPermission && req.user.permissions.includes(requiredPermission);
        
        // 3. ROLE FALLBACK
        // Only if the user has NO manual permissions at all (old system or not yet edited)
        const roleMatches = authorizedRoles.length === 0 || authorizedRoles.map(r => r.toUpperCase()).includes(userRole);
        
        if (isAdmin || hasExplicitAllow || (!hasExplicitPermissionsSet && roleMatches)) {
            return next();
        }
        
        logger.warn(`[AUTH] 🚫 RBAC DENIED: User Role '${userRole}' not in [${authorizedRoles.join(', ')}]`);
        return res.status(403).json({ 
            error: 'Access denied: insufficient permissions',
            details: { userRole, requiredRoles: authorizedRoles }
        });
    };
};

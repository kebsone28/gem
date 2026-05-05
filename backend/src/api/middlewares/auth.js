import { verifyAccessToken } from '../../core/utils/jwt.js';
import logger from '../../utils/logger.js';
import { runWithContext } from '../../core/context/storage.js';
import { normalizeRole } from '../../core/utils/roles.js';

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
        // contextStorage.run() keeps the AsyncLocalStorage store alive for all async operations
        // triggered by next(), including controller awaits.
        return runWithContext({ 
            userId: decoded.id, 
            organizationId: decoded.organizationId,
            projectId: req.headers['x-project-id'] || null, 
            role: decoded.role
        }, next);

    } catch (error) {
        logger.error('[AUTH-CRITICAL] Unexpected error in auth middleware:', error);
        res.status(500).json({ error: 'Internal server error during authentication' });
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

    // 🔑 Mapping de normalisation : variantes → rôle canonique
    // Règle métier :
    //   ADMIN_PROQUELEC = Super Admin (bypass total, voit tout)
    //   DIRECTEUR       = Directeur Général (approuve tout, passe par les routes normales)
    //   CHEF_PROJET/CP  = Chef de Projet (voit ses missions uniquement)

    return (req, res, next) => {
        const rawUserRole = req.user.role?.toUpperCase();
        const userRole = normalizeRole(rawUserRole); // Normalisation systématique
        const emailStr = req.user.email?.toLowerCase() || "";

        // 1. SYSTEM ADMIN BYPASS (God Mode)
        // Seul ADMIN_PROQUELEC a le bypass total de toutes les routes
        // DG_PROQUELEC a les droits d'approbation mais passe par les vérifications normales
        const isAdmin = userRole === 'ADMIN_PROQUELEC' ||
            emailStr === 'admin@proquelec.com';

        // 2. GRANULAR PERMISSION CHECK
        const hasExplicitPermissionsSet = req.user.permissionsWasManuallySet;
        const hasExplicitAllow = requiredPermission && req.user.permissions.includes(requiredPermission);

        // 3. ROLE FALLBACK — comparer les rôles normalisés
        const normalizedAuthorizedRoles = authorizedRoles.map(r => normalizeRole(r));
        const roleMatches = normalizedAuthorizedRoles.length === 0 || normalizedAuthorizedRoles.includes(userRole);

        // 4. LOGIQUE D'AUTORISATION :
        // -isAdmin: God Mode 
        // -hasExplicitAllow: L'utilisateur a la permission stricte demandée par la route
        // -(!requiredPermission && roleMatches): La route ne demande aucune permission, on se fie uniquement au Rôle.
        // -(!hasExplicitPermissionsSet && roleMatches): La route demande une permission, mais l'utilisateur n'a aucune permission configurée (legacy), on fallback sur son rôle.
        if (
            isAdmin || 
            hasExplicitAllow || 
            (!requiredPermission && roleMatches) || 
            (!hasExplicitPermissionsSet && roleMatches)
        ) {
            return next();
        }

        logger.warn(`[AUTH] 🚫 RBAC DENIED: User Role '${rawUserRole}' (→${userRole}) not in [${authorizedRoles.join(', ')}]`);
        return res.status(403).json({
            error: 'Access denied: insufficient permissions',
            details: { userRole, requiredRoles: authorizedRoles }
        });
    };
};

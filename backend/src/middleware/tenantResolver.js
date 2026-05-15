import { runWithContext } from '../core/context/storage.js';

/**
 * Middleware légère qui crée un contexte request-scoped même pour les routes non-auth.
 * Priorité headers → req.user → params
 */
export const tenantResolver = (req, res, next) => {
  try {
    const headerOrg = req.headers['x-organization-id'] || req.headers['x-org-id'];
    const headerProj = req.headers['x-project-id'] || req.headers['x-projid'];

    const organizationId = headerOrg || req.user?.organizationId || null;
    const projectId = headerProj || req.user?.projectId || req.params?.projectId || null;
    const userId = req.user?.id || null;

    return runWithContext({ organizationId, projectId, userId }, next);
  } catch (err) {
    // Fallback : ne pas bloquer la requête
    return next();
  }
};

export default tenantResolver;

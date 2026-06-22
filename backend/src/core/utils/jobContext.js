/**
 * Background Job Context Helper
 * Ensures background jobs run within proper tenant context
 *
 * Background jobs don't have HTTP request context, so they need explicit
 * context setup to ensure Prisma auto-filtering works correctly
 */

import { runWithContext } from '../context/storage.js';

/**
 * Execute function with explicit tenant context
 *
 * @example
 * await withJobContext({ organizationId, projectId }, async () => {
 *   const missions = await prisma.mission.findMany();  // auto-filtered by organizationId
 * });
 */
export const withJobContext = async (context, callback) => {
  return runWithContext({
    userId: context.userId || 'system-job',
    organizationId: context.organizationId,
    projectId: context.projectId || null,
    role: context.role || 'SYSTEM'
  }, callback);
};

/**
 * Higher-order function to wrap job functions with context
 *
 * @example
 * const checkProjectKPIs = withContext(
 *   async (projectId, organizationId) => {
 *     // This function runs with context set
 *     const households = await prisma.household.findMany();
 *   }
 * );
 */
export const withContext = (fn) => {
  return async (projectId, organizationId, userId = null, role = null) => {
    return withJobContext({
      organizationId,
      projectId,
      userId,
      role
    }, () => fn(projectId, organizationId));
  };
};

/**
 * Batch process organizations with context
 *
 * @example
 * await withBatchContext(organizations, async (org) => {
 *   const projects = await prisma.project.findMany();
 * });
 */
export const withBatchContext = async (items, callback) => {
  const results = [];
  for (const item of items) {
    const result = await withJobContext({
      organizationId: item.organizationId,
      projectId: item.projectId || null,
      userId: item.userId || 'system-job'
    }, () => callback(item));
    results.push(result);
  }
  return results;
};

import { runWithContext } from '../context/storage.js';

/**
 * Utility to run an async function with a temporary tenant context.
 * Example:
 * await createScopedPrisma({ organizationId, projectId }, async () => {
 *   await prisma.project.findMany();
 * });
 */
export const createScopedPrisma = async (context, fn) => {
  return runWithContext(context, fn);
};

export default createScopedPrisma;

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * GEM SAAS - Context Storage
 * Uses AsyncLocalStorage to hold request-scoped context (userId, organizationId).
 */
export const contextStorage = new AsyncLocalStorage();

/**
 * Get current context
 */
export const getContext = () => contextStorage.getStore() || {};

/**
 * Set current context (Middleware helper)
 */
export const runWithContext = (context, callback) => {
  return contextStorage.run(context, callback);
};

export const getOrganizationId = () => getContext().organizationId;
export const getUserId = () => getContext().userId;
export const getProjectId = () => getContext().projectId;

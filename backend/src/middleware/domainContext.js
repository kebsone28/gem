/**
 * DomainContext Middleware
 *
 * Extracts domain context from each request and injects:
 * - req.domainType: The domain being accessed
 * - req.domainConfig: The domain configuration
 * - req.domainAdapter: The domain adapter instance
 *
 * Domain is determined by:
 * 1. Query parameter: ?domainType=electricity
 * 2. Header: X-Domain-Type: electricity
 * 3. Default: 'electricity'
 */

import { DomainConfigService } from '../services/domain/DomainConfigService.js';
import { DomainAdapterFactory } from '../domain-adapters/DomainAdapterFactory.js';

/**
 * Middleware: Extract and load domain context
 */
export const domainContext = async (req, res, next) => {
  try {
    // Extract domain type from query, header, or default
    const domainType =
      req.query.domainType ||
      req.headers['x-domain-type'] ||
      req.headers['x-domain'] ||
      'electricity'; // Default

    // Validate domain type format
    if (typeof domainType !== 'string' || domainType.length === 0) {
      res.status(400).json({
        error: 'Invalid domainType',
        message: 'Domain type must be a non-empty string',
      });
      return;
    }

    // Check if domain is supported
    if (!DomainAdapterFactory.hasAdapter(domainType)) {
      const supported = DomainAdapterFactory.getSupportedDomains().join(', ');
      res.status(400).json({
        error: 'Unsupported domain',
        message: `Domain '${domainType}' is not supported. Supported domains: ${supported}`,
        supported,
      });
      return;
    }

    // Get organization from auth middleware (assumes auth is done before)
    const organizationId = req.user?.organizationId || req.headers['x-org-id'];

    if (!organizationId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Organization ID not found in request',
      });
      return;
    }

    // Load domain config
    const domainConfig = await DomainConfigService.getConfig(organizationId, domainType);

    // Get adapter
    const domainAdapter = DomainAdapterFactory.getAdapter(domainType);

    // Inject into request
    req.domainType = domainType;
    req.domainConfig = domainConfig;
    req.domainAdapter = domainAdapter;

    next();
  } catch (error) {
    console.error('[DomainContext] Error:', error);
    res.status(500).json({
      error: 'Domain context error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware: Optional domain context (doesn't fail if domain not found)
 * Useful for endpoints that don't require domain context
 */
export const domainContextOptional = async (req, res, next) => {
  try {
    const domainType = req.query.domainType || 'electricity';

    if (DomainAdapterFactory.hasAdapter(domainType)) {
      const organizationId = req.user?.organizationId || req.headers['x-org-id'];

      if (organizationId) {
        const domainConfig = await DomainConfigService.getConfig(organizationId, domainType);

        req.domainType = domainType;
        req.domainConfig = domainConfig;
        req.domainAdapter = DomainAdapterFactory.getAdapter(domainType);
      }
    }

    next();
  } catch (error) {
    // Silently continue on error for optional context
    console.warn(
      '[DomainContextOptional] Warning:',
      error instanceof Error ? error.message : error
    );
    next();
  }
};

/**
 * Helper: Get domain from request
 */
export function getDomainType(req) {
  return req.domainType || 'electricity';
}

/**
 * Helper: Get domain config from request
 */
export function getDomainConfig(req) {
  return req.domainConfig;
}

/**
 * Helper: Get domain adapter from request
 */
export function getDomainAdapter(req) {
  return req.domainAdapter;
}

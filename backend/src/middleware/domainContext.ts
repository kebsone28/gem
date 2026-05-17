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

import { Request, Response, NextFunction } from 'express';
import { DomainConfigService } from '../services/domain/DomainConfigService';
import { DomainAdapterFactory } from '../domain-adapters/DomainAdapterFactory';

/**
 * Extend Express Request to include domain context
 */
declare global {
  namespace Express {
    interface Request {
      domainType?: string;
      domainConfig?: any;
      domainAdapter?: any;
    }
  }
}

/**
 * Middleware: Extract and load domain context
 */
export const domainContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract domain type from query, header, or default
    const domainType =
      (req.query.domainType as string) ||
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

    // Get organization ID from req.user
    let organizationId = req.user?.organizationId || (req.headers['x-org-id'] as string);

    // If req.user is not yet populated (e.g. global middleware running before authProtect),
    // try to decode the token directly to extract the organizationId.
    if (!organizationId) {
      let token;
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer')) {
        token = authHeader.split(' ')[1];
      } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
      }

      if (token && token !== 'undefined' && token !== 'null' && token.length >= 20) {
        try {
          const { verifyAccessToken } = await import('../core/utils/jwt.js');
          const decoded = verifyAccessToken(token);
          if (decoded && decoded.organizationId) {
            organizationId = decoded.organizationId;
          }
        } catch (err) {
          // Ignore token decoding errors here; authProtect will handle it later
        }
      }
    }

    if (!organizationId) {
      // If no organizationId is resolved, do not block with 401.
      // Unauthenticated routes (pings, login) should load freely,
      // while authenticated routes will be blocked by authProtect later.
      return next();
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
export const domainContextOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const domainType = (req.query.domainType as string) || 'electricity';

    if (DomainAdapterFactory.hasAdapter(domainType)) {
      const organizationId = req.user?.organizationId || (req.headers['x-org-id'] as string);

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
export function getDomainType(req: Request): string {
  return req.domainType || 'electricity';
}

/**
 * Helper: Get domain config from request
 */
export function getDomainConfig(req: Request) {
  return req.domainConfig;
}

/**
 * Helper: Get domain adapter from request
 */
export function getDomainAdapter(req: Request) {
  return req.domainAdapter;
}

// Audit middleware – logs each request to the audit service
import { tracerAction } from '../services/audit.service.js';

/**
 * Global audit middleware.
 * Captures request details and stores an audit entry after the response is sent.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
export const auditLog = (req, res, next) => {
  const start = Date.now();
  // When the response finishes, record audit information
  res.on('finish', async () => {
    try {
      const organizationId = req.user?.organizationId || null;
      const userId = req.user?.id || null;
      const action = `${req.method} ${req.baseUrl}${req.path}`;
      const resource = req.baseUrl || '';
      const resourceId = req.params?.id || null;
      const details = {
        status: res.statusCode,
        responseTimeMs: Date.now() - start,
        query: req.query,
        body: req.body,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };
      await tracerAction({ organizationId, userId, action, resource, resourceId, details, req });
    } catch (e) {
      // Swallow errors to avoid breaking the request lifecycle
      // Optional: log to console if needed
      // console.error('Audit middleware error:', e);
    }
  });
  next();
};

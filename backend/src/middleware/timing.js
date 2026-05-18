/**
 * Request timing and tracing middleware
 * Generates requestId for request tracking across logs
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

const SLOW_REQUEST_THRESHOLD = 1000; // 1 second
const slowQueries = [];

/**
 * Add request timing and tracing
 * Generates requestId for request tracking across logs
 */
export const requestTimingMiddleware = (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach to request and response
  req.requestId = requestId;
  res.locals.requestId = requestId;

  // Store original send to intercept response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const slow = duration > SLOW_REQUEST_THRESHOLD;

    // Log request summary
    const logLevel = slow ? 'warn' : 'debug';
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      slow,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      timestamp: new Date().toISOString(),
    };

    if (logger[logLevel]) {
      logger[logLevel]('[TIMING]', logData);
    }

    // If slow, also store for analysis
    if (slow) {
      storeSlowQuery({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        timestamp: new Date(),
      });
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
};

function storeSlowQuery(query) {
  slowQueries.push(query);
  // Keep only last 100 slow queries
  if (slowQueries.length > 100) {
    slowQueries.shift();
  }
}

export function getSlowQueries(limit = 20) {
  return slowQueries.slice(-limit).reverse();
}

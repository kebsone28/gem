/**
 * Retry Service
 * Implements exponential backoff with jitter for failed sync operations.
 * Pure module — no React.
 */

import { logger } from '../logger';

export interface RetryConfig {
  /** Maximum number of attempts (including the first one) */
  maxAttempts: number;
  /** Base delay in ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Jitter factor 0–1 (adds randomness to avoid thundering herd) */
  jitter: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: 0.3,
};

/**
 * Calculate exponential backoff delay for a given attempt number (0-indexed).
 */
export function calcBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponential = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
  const jitterAmount = exponential * config.jitter * Math.random();
  return Math.floor(exponential + jitterAmount);
}

/**
 * Execute a function with automatic retry on failure.
 * Throws on final failure after exhausting all attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  label = 'operation'
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info('RETRY', `${label} succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (err) {
      lastError = err;

      // Do not retry on 4xx client errors (except 429 rate-limit)
      const status = (err as any)?.response?.status;
      if (status && status < 500 && status !== 429 && status !== 401) {
        logger.warn('RETRY', `${label} failed with ${status} — not retrying client error`);
        throw err;
      }

      // Stop on 401 — token is invalid, no point retrying
      if (status === 401) {
        logger.error('RETRY', `${label} — 401 Unauthorized, stopping retry loop`);
        throw err;
      }

      if (attempt < config.maxAttempts - 1) {
        const delay = calcBackoffDelay(attempt, config);
        logger.warn(
          'RETRY',
          `${label} attempt ${attempt + 1}/${config.maxAttempts} failed — retrying in ${delay}ms`,
          err
        );
        await sleep(delay);
      }
    }
  }

  logger.error('RETRY', `${label} exhausted ${config.maxAttempts} attempts`);
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

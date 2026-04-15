import logger from '../../../utils/logger.js';

/**
 * RetryPolicy - Intelligent retry with exponential backoff
 * 
 * Strategies:
 * - Exponential backoff: 100ms, 200ms, 400ms, 800ms...
 * - Jitter: Add randomness to prevent thundering herd
 * - Max attempts: Configurable per error type
 */
class RetryPolicy {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelay = options.baseDelay || 100; // milliseconds
    this.maxDelay = options.maxDelay || 5000; // max backoff
    this.timeoutMultiplier = options.timeoutMultiplier || 1.5;
    
    // Don't retry on specific errors
    this.nonRetryableErrors = new Set([
      'AUTHENTICATION_ERROR',
      '401',
      '403',
      'FORBIDDEN',
      'UNAUTHORIZED',
      'INVALID_API_KEY'
    ]);

    // Retry more aggressively on these errors
    this.retryableErrors = new Set([
      'TIMEOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      '429', // rate limit
      '500', // server error
      '502', // bad gateway
      '503', // service unavailable
      'NETWORK_ERROR'
    ]);

    this.attemptLog = [];
  }

  /**
   * Execute with retry policy
   */
  async executeWithRetry(fn, context = {}) {
    const executionId = this.generateId();
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${this.maxAttempts}`, {
          executionId,
          context: context.service || 'unknown'
        });

        const result = await fn();
        
        this.recordAttempt(executionId, attempt, 'success', null, context);
        return result;

      } catch (error) {
        lastError = error;
        const shouldRetry = this.shouldRetry(error, attempt, context);

        this.recordAttempt(executionId, attempt, 'failed', error.message, context);

        if (!shouldRetry) {
          logger.error(`Not retrying - ${error.message}`, {
            executionId,
            attempt,
            reason: this.getRetryReason(error)
          });
          throw error;
        }

        if (attempt < this.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          logger.warn(`Retrying after ${delay}ms`, {
            executionId,
            attempt,
            nextAttempt: attempt + 1,
            error: error.message
          });

          await this.sleep(delay);
        }
      }
    }

    logger.error(`All ${this.maxAttempts} attempts failed`, {
      executionId,
      lastError: lastError?.message
    });
    throw lastError;
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error, currentAttempt, context = {}) {
    if (currentAttempt >= this.maxAttempts) {
      return false;
    }

    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    // Check non-retryable errors
    for (const code of this.nonRetryableErrors) {
      if (errorMessage.includes(code) || errorCode.includes(code)) {
        return false;
      }
    }

    // Check retryable errors
    for (const code of this.retryableErrors) {
      if (errorMessage.includes(code) || errorCode.includes(code)) {
        return true;
      }
    }

    // Default: retry on network-like errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('connection') || 
        errorMessage.includes('unreachable')) {
      return true;
    }

    // Default: don't retry on unknown errors
    return false;
  }

  /**
   * Get reason why retry was or wasn't attempted
   */
  getRetryReason(error) {
    const errorMessage = error.message || '';

    if (this.nonRetryableErrors.has(errorMessage)) {
      return 'Non-retryable error';
    }

    if (this.retryableErrors.has(errorMessage)) {
      return 'Retryable error detected';
    }

    if (errorMessage.includes('timeout')) {
      return 'Timeout error';
    }

    if (errorMessage.includes('connection')) {
      return 'Connection error';
    }

    return 'Unknown error';
  }

  /**
   * Calculate delay with exponential backoff + jitter
   */
  calculateDelay(attemptNumber) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attemptNumber - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter: ±20% randomness
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
    const finalDelay = Math.max(1, cappedDelay + jitter);

    return Math.floor(finalDelay);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record retry attempt
   */
  recordAttempt(executionId, attemptNumber, status, error, context) {
    this.attemptLog.push({
      executionId,
      attemptNumber,
      status,
      error,
      service: context.service || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 records
    if (this.attemptLog.length > 1000) {
      this.attemptLog = this.attemptLog.slice(-1000);
    }
  }

  /**
   * Generate execution ID
   */
  generateId() {
    return `retry_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get retry statistics
   */
  getStats() {
    const byService = {};
    const byStatus = { success: 0, failed: 0 };
    const needingRetry = this.attemptLog.filter((log, idx) => {
      return idx > 0 && this.attemptLog[idx - 1].executionId === log.executionId;
    });

    for (const log of this.attemptLog) {
      if (!byService[log.service]) {
        byService[log.service] = { attempts: 0, retries: 0, failures: 0 };
      }
      byService[log.service].attempts++;
      if (log.status === 'success') {
        byStatus.success++;
      } else {
        byStatus.failed++;
        byService[log.service].failures++;
      }
    }

    return {
      totalAttempts: this.attemptLog.length,
      retriesNeeded: needingRetry.length,
      byStatus,
      byService,
      averageAttemptsPerExecution: this.attemptLog.length > 0 
        ? (this.attemptLog.length / new Set(this.attemptLog.map(l => l.executionId)).size).toFixed(2)
        : 0
    };
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.attemptLog = [];
  }
}

export default RetryPolicy;

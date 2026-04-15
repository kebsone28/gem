import logger from '../../../utils/logger.js';

/**
 * CircuitBreakerService - Multi-layer resilience system
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, requests blocked, fallback activated
 * - HALF_OPEN: Testing recovery, single request allowed
 */
class CircuitBreakerService {
  constructor(options = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.halfOpenTimeout = options.halfOpenTimeout || 60000; // 60 seconds before retry

    // State tracking
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastErrorMessage = null;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;

    // Metrics collection
    this.metrics = {
      stateChanges: [],
      errors: []
    };

    // For handling half-open state
    this.halfOpenStartTime = null;
  }

  /**
   * Main execution method with circuit breaker logic
   */
  async call(fn, options = {}) {
    const startTime = Date.now();
    this.totalRequests++;

    try {
      // Check if circuit is OPEN
      if (this.state === 'OPEN') {
        if (this.shouldAttemptHalfOpen()) {
          this.setState('HALF_OPEN');
          logger.info(`⚡ Circuit ${this.name}: Attempting recovery (HALF_OPEN)`, {
            failureCount: this.failureCount,
            timeSinceLastFailure: Date.now() - this.lastFailureTime
          });
        } else {
          throw new Error(
            `Circuit ${this.name} is OPEN. Fallback required. Last error: ${this.lastErrorMessage}`
          );
        }
      }

      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn, options.timeout || this.timeout);
      this.onSuccess();

      return result;
    } catch (error) {
      this.onFailure(error, options);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.recordMetric('request', {
        duration,
        state: this.state,
        success: false // Will be updated if no error
      });
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.setState('CLOSED');
        this.successCount = 0;
        logger.info(`✅ Circuit ${this.name}: Recovered (CLOSED)`, {
          totalSuccesses: this.totalSuccesses,
          totalFailures: this.totalFailures
        });
      }
    } else if (this.state === 'CLOSED') {
      this.successCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error, options = {}) {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.lastErrorMessage = error.message;

    this.metrics.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      service: options.service || 'unknown'
    });

    logger.warn(`⚠️ Circuit ${this.name}: Failure detected`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message,
      state: this.state
    });

    if (this.state === 'HALF_OPEN') {
      // Failure in half-open = back to OPEN
      this.setState('OPEN');
      this.failureCount = 0;
      this.successCount = 0;
      logger.error(`🔴 Circuit ${this.name}: Recovery failed, circuit OPEN again`, {
        error: error.message
      });
    } else if (this.failureCount >= this.failureThreshold) {
      // Too many failures = OPEN
      this.setState('OPEN');
      logger.error(`🔴 Circuit ${this.name}: Threshold reached, circuit OPEN`, {
        failures: this.failureCount,
        threshold: this.failureThreshold,
        error: error.message
      });
    }
  }

  /**
   * Check if we should attempt recovery (HALF_OPEN)
   */
  shouldAttemptHalfOpen() {
    if (this.state !== 'OPEN') return false;
    if (!this.lastFailureTime) return true;

    const timeSinceFailure = Date.now() - this.lastFailureTime;
    return timeSinceFailure >= this.halfOpenTimeout;
  }

  /**
   * Update state and log change
   */
  setState(newState) {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    if (newState === 'HALF_OPEN') {
      this.halfOpenStartTime = Date.now();
    }

    this.metrics.stateChanges.push({
      timestamp: new Date().toISOString(),
      from: oldState,
      to: newState
    });

    logger.info(`Circuit ${this.name} state change: ${oldState} → ${newState}`);
  }

  /**
   * Record metrics for monitoring
   */
  recordMetric(type, data) {
    // Could be extended for real monitoring system
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    this.metrics[type].push({
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastErrorMessage: this.lastErrorMessage,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      successRate: this.totalRequests > 0 
        ? ((this.totalSuccesses / this.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A',
      isHealthy: this.state === 'CLOSED' || this.state === 'HALF_OPEN',
      shouldFallback: this.state === 'OPEN'
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    logger.info(`Circuit ${this.name}: Manual reset`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastErrorMessage = null;
  }
}

export default CircuitBreakerService;

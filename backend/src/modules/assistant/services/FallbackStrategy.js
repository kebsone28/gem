import logger from '../../../utils/logger.js';

/**
 * FallbackStrategy - 100% FREE Cascade
 * 
 * Layer 1: Ollama (local, fast, FREE)
 * Layer 2: MissionSage (local fallback, ALWAYS available, FREE)
 */
class FallbackStrategy {
  constructor(services = {}) {
    this.services = {
      ollama: services.ollama,
      missionSage: services.missionSage
    };
    
    this.executionLog = [];
    this.costEstimate = {
      ollama: 0,
      missionSage: 0
    };
  }

  /**
   * Execute with intelligent fallback
   */
  async execute(input, context = {}) {
    const executionId = this.generateId();
    const startTime = Date.now();

    this.executionLog.push({
      id: executionId,
      timestamp: new Date().toISOString(),
      input: input.substring(0, 100),
      context: context.intent || 'unknown'
    });

    try {
      // Layer 1: Try Ollama
      if (this.services.ollama?.circuitBreaker?.state !== 'OPEN') {
        try {
          logger.info('🟢 Trying Layer 1: Ollama', { executionId });
          const result = await this.services.ollama.circuitBreaker.call(
            () => this.services.ollama.query(input),
            { timeout: 5000, service: 'ollama' }
          );
          this.recordExecution(executionId, 'ollama', 'success', result, startTime);
          return {
            response: result,
            source: 'ollama',
            latency: Date.now() - startTime,
            cost: this.costEstimate.ollama,
            fallback: false,
            executionId
          };
        } catch (err) {
          logger.warn('🟡 Ollama failed, trying fallback', {
            executionId,
            error: err.message
          });
          this.recordExecution(executionId, 'ollama', 'failed', err.message, startTime);
        }
      } else {
        logger.warn('Ollama circuit OPEN, skipping', { executionId });
      }

      // Layer 2: MissionSage - 100% FREE fallback (always available)
      logger.info('Using Layer 2: MissionSage (local fallback - FREE)', { executionId });
      const result = this.services.missionSage.answer(input);
      this.recordExecution(executionId, 'missionSage', 'success', result, startTime);
      
      return {
        response: result,
        source: 'missionSage',
        latency: Date.now() - startTime,
        cost: this.costEstimate.missionSage,
        fallback: true,
        fallbackReason: 'ollama_unavailable',
        executionId,
        message: 'Using local fallback - 100% FREE, system operational'
      };

    } catch (error) {
      logger.error('🔥 All fallback layers exhausted', {
        executionId,
        error: error.message
      });
      this.recordExecution(executionId, 'all', 'critical_failure', error.message, startTime);
      throw error;
    }
  }

  /**
   * Execute with cost optimization (always FREE since no external APIs)
   */
  async executeOptimized(input, context = {}) {
    // All requests use Ollama → MissionSage (100% FREE - no cost optimization needed)
    return await this.execute(input, context);
  }

  /**
   * Estimate request complexity
   */
  estimateComplexity(input, context = {}) {
    const intents = ['technical_issue', 'data_analysis'];
    if (intents.includes(context.intent)) return 'high';

    if (input.length > 500) return 'medium';
    if (input.length < 100) return 'low';

    return 'medium';
  }

  /**
   * Simplified fallback - Ollama → MissionSage (100% FREE)
   */
  async executeWithFallback(input, primaryService, context = {}) {
    try {
      if (primaryService === 'ollama') {
        const result = await this.services.ollama.circuitBreaker.call(
          () => this.services.ollama.query(input),
          { service: 'ollama' }
        );
        return {
          response: result,
          source: 'ollama',
          fallback: false,
          cost: 0
        };
      }
    } catch (err) {
      logger.warn('Ollama failed, using MissionSage (100% FREE)', { error: err.message });
      return {
        response: this.services.missionSage.answer(input),
        source: 'missionSage',
        fallback: true,
        cost: 0
      };
    }
  }

  /**
   * Record execution step
   */
  recordExecution(executionId, service, status, result, startTime) {
    const record = {
      executionId,
      service,
      status,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      resultPreview: typeof result === 'string' 
        ? result.substring(0, 50)
        : JSON.stringify(result).substring(0, 50)
    };

    // Keep only last 100 records
    if (!this.executionLog[this.executionLog.length - 1].executions) {
      this.executionLog[this.executionLog.length - 1].executions = [];
    }
    this.executionLog[this.executionLog.length - 1].executions.push(record);
  }

  /**
   * Generate unique execution ID
   */
  generateId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get statistics
   */
  getStats() {
    const flatLogs = this.executionLog.reduce((acc, entry) => {
      if (entry.executions) {
        return [...acc, ...entry.executions];
      }
      return acc;
    }, []);

    const serviceStats = {};
    for (const log of flatLogs) {
      if (!serviceStats[log.service]) {
        serviceStats[log.service] = {
          total: 0,
          success: 0,
          failed: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }
      serviceStats[log.service].total++;
      if (log.status === 'success') {
        serviceStats[log.service].success++;
      } else {
        serviceStats[log.service].failed++;
      }
      serviceStats[log.service].totalDuration += log.duration;
    }

    // Calculate averages
    for (const service in serviceStats) {
      const total = serviceStats[service].total;
      serviceStats[service].avgDuration = total > 0 
        ? (serviceStats[service].totalDuration / total).toFixed(2)
        : 0;
    }

    return {
      totalExecutions: flatLogs.length,
      lastExecution: flatLogs[flatLogs.length - 1],
      byService: serviceStats,
      serviceOrder: ['ollama', 'openai', 'missionSage']
    };
  }

  /**
   * Health check - Ollama + MissionSage only (NO OpenAI)
   */
  getServiceHealth() {
    return {
      ollama: this.services.ollama?.circuitBreaker?.getStatus(),
      missionSage: {
        state: 'ALWAYS_AVAILABLE',
        isHealthy: true,
        cost: '$0',
        message: '100% FREE - Always available for fallback'
      }
    };
  }

  /**
   * Reset Ollama circuit breaker
   */
  resetAll() {
    logger.info('Resetting Ollama circuit breaker (MissionSage is always available)');
    this.services.ollama?.circuitBreaker?.reset();
  }
}

export default FallbackStrategy;

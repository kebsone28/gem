import logger from '../../../utils/logger.js';
import CircuitBreakerService from './CircuitBreakerService.js';
import FallbackStrategy from './FallbackStrategy.js';
import RetryPolicy from './RetryPolicy.js';
import { queryOllama } from '../ollama.client.js';
import { config } from '../../../core/config/config.js';

/**
 * AIRouterService - Intelligent AI request routing with resilience
 * 
 * 🔥 100% FREE & OPENSOURCE VERSION
 * 
 * Orchestrates:
 * - Circuit breaker for Ollama (local, free)
 * - Fallback to MissionSage (local, free)
 * - Retry policy with exponential backoff
 * - $0 cost guaranteed
 * - Metrics collection
 */
class AIRouterService {
  constructor(options = {}) {
    this.initialized = false;
    
    // Create circuit breaker for Ollama (primary)
    this.ollamaBreaker = new CircuitBreakerService({
      name: 'Ollama',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 5000,
      halfOpenTimeout: 30000
    });

    // Create retry policy
    this.ollamaRetry = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 2000
    });

    // Store references to callables
    this.ollamaService = { circuitBreaker: this.ollamaBreaker };
    
    // Reference to MissionSage (passed during init)
    this.missionSage = null;

    // Metrics
    this.metrics = {
      requestsTotal: 0,
      requestsByService: {},
      costEstimate: 0
    };

    this.initialized = false;
  }

  /**
   * Initialize with external services (MissionSage only - free version)
   */
  initialize(missionSage, ollamaQuery = null) {
    this.missionSage = missionSage;
    
    // Bind query functions
    this.ollamaService.query = ollamaQuery || queryOllama;
    
    // Create fallback strategy (Ollama → MissionSage only, NO OpenAI)
    this.fallbackStrategy = new FallbackStrategy({
      ollama: this.ollamaService,
      missionSage: this.missionSage
    });

    this.initialized = true;
    logger.info('✅ AIRouterService initialized - 100% FREE (Ollama + MissionSage only)');
  }

  /**
   * Main routing method - handles all AI requests
   */
  async route(input, context = {}) {
    if (!this.initialized) {
      throw new Error('AIRouterService not initialized');
    }

    this.metrics.requestsTotal++;
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    logger.info('🚀 AI request routed', {
      requestId,
      intent: context.intent,
      service: context.preferredService || 'auto',
      complexity: context.complexity || 'unknown'
    });

    try {
      // Check for emergency bypass (from ApprovalExecutor)
      if (process.env.APPROVAL_SYSTEM_BYPASS === 'true') {
        logger.warn('⚠️ Emergency bypass active - routing may be affected');
      }

      // Use optimized execution for cost efficiency
      const result = await this.executeOptimized(input, context, requestId);
      
      const duration = Date.now() - startTime;
      this.recordMetrics(context.intent, result.source, duration);

      return {
        response: result.response,
        source: result.source,
        latency: duration,
        cost: result.cost,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        requestId,
        circuitState: this.getCircuitStates()
      };

    } catch (error) {
      logger.error('🔥 AI routing failed completely', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute with optimization for cost and latency
   */
  async executeOptimized(input, context = {}, requestId) {
    const complexity = this.estimateComplexity(input, context);
    
    logger.info('📊 Executing optimized routing', {
      requestId,
      complexity,
      intent: context.intent
    });

    // Simple requests: local only (cost: $0)
    if (complexity === 'low') {
      logger.info('📍 Using local-only strategy', { requestId, complexity });
      const response = this.missionSage.answer(input);
      return {
        response,
        source: 'missionSage',
        cost: 0,
        fallback: false
      };
    }

    // Medium: Ollama with fallback (cost: $0-$0.0005)
    if (complexity === 'medium') {
      logger.info('🟡 Using Ollama-first strategy', { requestId, complexity });
      return await this.ollamaRetry.executeWithRetry(
        () => this.fallbackStrategy.executeWithFallback(input, 'ollama', context),
        { service: 'ollama', requestId }
      );
    }

    // High complexity: Full cascade (cost: $0 to $0.0005)
    if (complexity === 'high') {
      logger.info('🟢 Using full cascade strategy', { requestId, complexity });
      return await this.ollamaRetry.executeWithRetry(
        () => this.fallbackStrategy.execute(input, context),
        { service: 'cascade', requestId }
      );
    }

    // Default: standard execution
    return await this.fallbackStrategy.execute(input, context);
  }

  /**
   * Estimate complexity based on input and context
   */
  estimateComplexity(input, context = {}) {
    const complexIntents = [
      'technical_issue',
      'data_analysis',
      'help_request'
    ];

    // High complexity indicators
    if (complexIntents.includes(context.intent)) return 'high';
    if (input.length > 500) return 'high';
    if (context.requiresHighAccuracy) return 'high';

    // Low complexity indicators
    if (input.length < 50) return 'low';
    if (context.intent === 'greeting') return 'low';
    if (context.intent === 'casual_chat') return 'low';

    // Default: medium
    return 'medium';
  }

  /**
   * Record metrics for monitoring
   */
  recordMetrics(intent, source, duration) {
    if (!this.metrics.requestsByService[source]) {
      this.metrics.requestsByService[source] = {
        total: 0,
        totalDuration: 0,
        avgDuration: 0
      };
    }

    this.metrics.requestsByService[source].total++;
    this.metrics.requestsByService[source].totalDuration += duration;
    this.metrics.requestsByService[source].avgDuration = 
      this.metrics.requestsByService[source].totalDuration / 
      this.metrics.requestsByService[source].total;

    // Track cost
    if (source === 'openai') {
      this.metrics.costEstimate += 0.0005;
    }
  }

  /**
   * Get current circuit states
   */
  getCircuitStates() {
    return {
      ollama: this.ollamaBreaker.getStatus(),
      missionSage: {
        state: 'ALWAYS_AVAILABLE',
        isHealthy: true,
        cost: '$0'  // FREE
      }
    };
  }

  /**
   * Get comprehensive health status
   */
  getHealthStatus() {
    return {
      isHealthy: true,  // Always healthy - MissionSage is always available
      mode: '100% FREE - Ollama + MissionSage (No OpenAI)',
      circuits: this.getCircuitStates(),
      metrics: {
        totalRequests: this.metrics.requestsTotal,
        byService: this.metrics.requestsByService,
        estimatedCost: `$${this.metrics.costEstimate.toFixed(4)}`,
        fallbackStats: this.fallbackStrategy.getStats()
      }
    };
  }

  /**
   * Reset circuit breaker (admin only)
   */
  resetAll() {
    logger.warn('⚠️ ADMIN: Resetting Ollama circuit breaker (MissionSage never resets)');
    this.ollamaBreaker.reset();
    return {
      status: 'Ollama circuit breaker reset',
      circuits: this.getCircuitStates()
    };
  }

  /**
   * Generate request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics() {
    return {
      overview: {
        totalRequests: this.metrics.requestsTotal,
        estimatedCost: '$0.00',  // 100% FREE
        mode: '100% Opensource - No external AI costs'
      },
      byService: this.metrics.requestsByService,
      circuitBreakers: {
        ollama: this.ollamaBreaker.getStatus()
      },
      fallback: this.fallbackStrategy.getStats(),
      retry: {
        ollama: this.ollamaRetry.getStats()
      },
      serviceHealth: this.fallbackStrategy.getServiceHealth()
    };
  }
}

// Singleton instance
let instance = null;

export function initializeAIRouter(missionSage, ollamaQuery = null) {
  if (!instance) {
    instance = new AIRouterService();
  }
  instance.initialize(missionSage, ollamaQuery);
  return instance;
}

export function getAIRouter() {
  if (!instance) {
    throw new Error('AIRouterService not initialized. Call initializeAIRouter first.');
  }
  return instance;
}

export default AIRouterService;

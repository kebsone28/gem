export class Agent {
  constructor(name, tools, planner) {
    this.name = name;
    this.tools = tools;
    this.planner = planner;
    this.lastExecutionMetrics = {};
  }

  /**
   * Calcule un confidence score basé sur:
   * - Succès des tools
   * - Pertinence du plan
   * - Qualité des résultats
   */
  calculateConfidence(plan, results, errors) {
    let score = 1.0;

    // Réduire pour chaque erreur
    score -= (errors.length * 0.15);

    // Réduire si plan très court ou très incomplet
    if (plan.length === 0) score -= 0.2;
    if (results.length < plan.length * 0.5) score -= 0.1;

    // Réduire si résultats vides
    if (results.every(r => !r || r.error)) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Exécute une tâche avec retry, fail-safe et confidence scoring
   */
  async execute(task, context = {}) {
    const executionStart = Date.now();
    const results = [];
    const errors = [];
    const toolsUsed = [];

    try {
      const plan = await this.plan(task, context);

      if (!plan || plan.length === 0) {
        throw new Error('No valid execution plan generated');
      }

      // Exécuter chaque étape du plan avec fail-safe
      for (const step of plan) {
        if (!step.tool) {
          errors.push('Step sans tool défini');
          continue;
        }

        const tool = this.tools[step.tool];
        if (!tool) {
          errors.push(`Outil non trouvé: ${step.tool}`);
          results.push({
            tool: step.tool,
            success: false,
            error: `Tool non trouvé: ${step.tool}`,
            data: null
          });
          continue;
        }

        toolsUsed.push(step.tool);

        try {
          // Exécute le tool avec timeout
          const toolPromise = tool(step.input, context);
          const output = await Promise.race([
            toolPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Tool timeout')), 30000)
            )
          ]);

          results.push({
            tool: step.tool,
            success: true,
            data: output,
            error: null
          });
        } catch (toolErr) {
          // Fail-safe: continuer même si un tool échoue
          const errorMsg = toolErr.message || 'Unknown error';
          errors.push(errorMsg);
          results.push({
            tool: step.tool,
            success: false,
            error: errorMsg,
            data: null
          });
        }
      }

      // Calculer metrics et confidence
      const executionEnd = Date.now();
      const confidence = this.calculateConfidence(plan, results, errors);

      this.lastExecutionMetrics = {
        duration: executionEnd - executionStart,
        toolsExecuted: toolsUsed.length,
        successRate: results.filter(r => r.success).length / results.length,
        confidence,
        errorsCount: errors.length
      };

      return this.buildExecutionResult(results, task, errors, confidence, toolsUsed);
    } catch (err) {
      // Fail-safe global: si erreur critique
      const confidence = 0.0;
      this.lastExecutionMetrics = {
        duration: Date.now() - executionStart,
        toolsExecuted: toolsUsed.length,
        successRate: 0,
        confidence,
        errorsCount: errors.length + 1,
        criticalError: err.message
      };

      return {
        success: false,
        agentName: this.name,
        confidence,
        task,
        message: `Erreur critique lors de l'exécution: ${err.message}`,
        results,
        errors: [...errors, err.message],
        toolsUsed,
        metrics: this.lastExecutionMetrics
      };
    }
  }

  /**
   * Construit le résultat d'exécution structuré
   */
  buildExecutionResult(results, task, errors, confidence, toolsUsed) {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      success: successCount > 0,
      agentName: this.name,
      task,
      confidence,
      summary: this.summarize(results, task),
      results,
      errors,
      toolsUsed,
      stats: {
        successCount,
        totalCount,
        successRate: totalCount > 0 ? successCount / totalCount : 0
      },
      metrics: this.lastExecutionMetrics
    };
  }

  /**
   * Génère un plan d'exécution
   */
  async plan(task, context) {
    try {
      if (typeof this.planner !== 'function') {
        return [
          { tool: 'analyze', input: task },
          { tool: 'queryDB', input: task }
        ];
      }

      const rawPlan = await this.planner(task, context);
      if (!Array.isArray(rawPlan) || rawPlan.length === 0) {
        return [
          { tool: 'analyze', input: task },
          { tool: 'queryDB', input: task }
        ];
      }

      return rawPlan;
    } catch (err) {
      // Fallback: simple default plan
      return [
        { tool: 'analyze', input: task }
      ];
    }
  }

  /**
   * Résume les résultats
   */
  summarize(results, task) {
    const successResults = results.filter(r => r.success && r.data);
    const failedResults = results.filter(r => !r.success);

    let summary = `Agent ${this.name} a traité: ${task}\n`;
    summary += `Résultats: ${successResults.length}/${results.length} réussis\n`;

    if (successResults.length > 0) {
      summary += 'Données:\n';
      successResults.forEach(r => {
        summary += `- [${r.tool}] ${JSON.stringify(r.data).substring(0, 100)}...\n`;
      });
    }

    if (failedResults.length > 0) {
      summary += 'Erreurs:\n';
      failedResults.forEach(r => {
        summary += `- [${r.tool}] ${r.error}\n`;
      });
    }

    return summary;
  }
}

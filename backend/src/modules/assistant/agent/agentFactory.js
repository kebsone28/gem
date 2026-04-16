/* eslint-disable @typescript-eslint/no-unused-vars */
import { Agent } from './AgentCore.js';
import { agentTools } from './agentTools.js';
import { queryOllama } from '../ollama.client.js';

function createPlanner(agentName) {
  return async (task, context = {}) => {
    const capability = {
      TechAgent: 'diagnostic électrique, inspection technique, dépannage',
      DataAgent: 'analyse de données, détection d anomalies, rapport statistique',
      SupportAgent: 'support utilisateur, explication, priorisation, conseils'
    }[agentName] || 'assistant généraliste';

    const prompt = `Tu es ${agentName}, un agent spécialisé pour PROQUELEC. Ton rôle: ${capability}.` +
      `\nTu dois transformer la tâche suivante en une liste d'étapes JSON.` +
      `\nTâche: ${task}` +
      `\nContexte: ${JSON.stringify(context || {})}` +
      `\nRetourne uniquement un JSON de la forme [{"tool":"nomOutil","input":{"..."}}].`;

    const response = await queryOllama(prompt);
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      return [
        { tool: 'getHouseholds', input: { task } },
        { tool: 'analyzeConsumption', input: { data: [] } }
      ];
    }

    return [
      { tool: 'getHouseholds', input: { task } },
      { tool: 'analyzeConsumption', input: { data: [] } }
    ];
  };
}

export function createAgent(agentName) {
  const availableTools = {
    TechAgent: {
      getHouseholds: agentTools.getHouseholds,
      analyzeConsumption: agentTools.analyzeConsumption,
      createReport: agentTools.createReport,
      callAPI: agentTools.callAPI
    },
    DataAgent: {
      getHouseholds: agentTools.getHouseholds,
      analyzeConsumption: agentTools.analyzeConsumption,
      createReport: agentTools.createReport,
      callAPI: agentTools.callAPI
    },
    SupportAgent: {
      createReport: agentTools.createReport,
      callAPI: agentTools.callAPI
    }
  };

  const tools = availableTools[agentName] || availableTools.SupportAgent;
  return new Agent(agentName, tools, createPlanner(agentName));
}

import prisma from '../../../core/utils/prisma.js';

export const agentTools = {
  getHouseholds: async (input, context = {}) => {
    const filter = {};
    if (context.organizationId) {
      filter.organizationId = context.organizationId;
    }

    const households = await prisma.household.findMany({ where: filter, take: 100 });
    return `Maisons récupérées: ${households.length}. Exemple: ${households.slice(0, 3).map((h) => h.name || h.id).join(', ')}`;
  },

  analyzeConsumption: async (input, context = {}) => {
    const anomalies = [];
    const inspections = Array.isArray(input.data) ? input.data : [];
    for (const item of inspections) {
      if (item?.consumption && item.consumption > (item?.threshold || 100)) {
        anomalies.push(`Anomalie détectée pour ${item.householdId || item.id}`);
      }
    }

    if (!inspections.length) {
      return 'Aucune donnée de consommation structurée fournie pour analyse.';
    }

    return anomalies.length > 0 ? `Anomalies détectées: ${anomalies.join('; ')}` : 'Aucune anomalie détectée dans les données de consommation.';
  },

  createReport: async (input) => {
    const report = {
      title: input.title || 'Rapport PROQUELEC',
      generatedAt: new Date().toISOString(),
      summary: input.summary || 'Rapport généré par l’agent',
      items: input.items || []
    };
    return `Rapport créé: ${report.title}, items: ${report.items.length}`;
  },

  callAPI: async (input) => {
    if (!input?.url) {
      throw new Error('URL manquante pour callAPI');
    }

    const response = await fetch(input.url, {
      method: input.method || 'GET',
      headers: input.headers || {},
      body: input.body ? JSON.stringify(input.body) : undefined
    });

    const data = await response.json();
    return `API appelée ${input.url}, status ${response.status}, body keys: ${Object.keys(data).join(', ')}`;
  }
};

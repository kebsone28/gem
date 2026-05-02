/**
 * Worker pour le traitement intensif des données du Bordereau
 * Gère le filtrage, le tri et les statistiques de grands volumes de données (Ménages, Grappes)
 * sans bloquer le thread principal (UI).
 */

type BordereauHousehold = {
  id?: string | number;
  numeroordre?: string | number;
  owner?: string | { name?: string };
  name?: string;
  region?: string;
  departement?: string;
  village?: string;
  grappeName?: string;
};

type BordereauGrappe = {
  id?: string | number;
  name?: string;
  region?: string;
  householdCount?: number | string;
  electrified?: number | string;
};

self.onmessage = (e: MessageEvent) => {
  const { action, data, params } = e.data;

  switch (action) {
    case 'FILTER_HOUSEHOLDS':
      self.postMessage({
        action: 'FILTER_HOUSEHOLDS_RESULT',
        result: filterHouseholds(data, params.query),
        correlationId: params.correlationId
      });
      break;

    case 'CALCULATE_STATS':
      self.postMessage({
        action: 'CALCULATE_STATS_RESULT',
        result: calculateStats(data),
      });
      break;

    case 'GROUP_AND_FILTER_GRAPPES':
      self.postMessage({
        action: 'GROUP_AND_FILTER_GRAPPES_RESULT',
        result: groupAndFilterGrappes(data, params.query),
      });
      break;

    default:
      break;
  }
};

/**
 * Filtrage performant des ménages
 */
function filterHouseholds(households: BordereauHousehold[], query: string) {
  if (!query || query.trim() === '') return households;

  const q = query.toLowerCase().trim();
  return households.filter((h) => {
    const ownerName = (typeof h.owner === 'string' ? h.owner : h.owner?.name) || h.name || '';
    const id = String(h.numeroordre || h.id || '');
    const location = `${h.region || ''} ${h.departement || ''} ${h.village || ''}`;

    return ownerName.toLowerCase().includes(q) ||
           id.toLowerCase().includes(q) ||
           location.toLowerCase().includes(q) ||
           (h.grappeName && h.grappeName.toLowerCase().includes(q));
  });
}

/**
 * Calcul des statistiques globales
 */
function calculateStats(grappes: BordereauGrappe[]) {
  let total = 0;
  let delivered = 0;
  let critical = 0;

  for (let i = 0; i < grappes.length; i++) {
    const g = grappes[i];
    const hCount = Number(g.householdCount) || 0;
    const eCount = Number(g.electrified) || 0;

    total += hCount;
    delivered += eCount;

    if (eCount === 0 && hCount > 0) {
      critical++;
    }
  }

  const pending = total - delivered;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return { total, delivered, pending, pct, critical };
}

/**
 * Groupage par région et filtrage des grappes
 */
function groupAndFilterGrappes(grappes: BordereauGrappe[], query: string) {
  const q = query ? query.toLowerCase().trim() : '';
  const grouped: Record<string, BordereauGrappe[]> = {};
  const regionsSet = new Set();

  for (let i = 0; i < grappes.length; i++) {
    const g = grappes[i];
    const region = g.region || 'Sans Région';

    const matchesRegion = region.toLowerCase().includes(q);
    const matchesGrappe = (g.name || '').toLowerCase().includes(q);

    if (!q || matchesRegion || matchesGrappe) {
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(g);
      regionsSet.add(region);
    }
  }

  return {
    groupedData: grouped,
    filteredRegions: Array.from(regionsSet).sort()
  };
}

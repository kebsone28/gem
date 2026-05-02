 
/**
 * searchWorker.ts
 *
 * Background Web Worker for high-performance fuzzy search indexing.
 * Uses MiniSearch to handle 50,000+ records with:
 * - Prefix search (e.g., "bak" -> "bakel")
 * - Fuzzy matching (Levenshtein distance)
 * - Multi-field indexing (ID, Name, Village, Phone)
 */

import MiniSearch from 'minisearch';

interface HouseholdDocument {
  id: string;
  owner?: { name: string };
  name?: string;
  numeroordre?: string;
  phone?: string;
  [key: string]: unknown;
}

const miniSearch = new MiniSearch({
  fields: ['id', 'name', 'phone', 'numeroordre'], // fields to index for full-text search
  storeFields: ['id', 'name', 'phone', 'numeroordre', 'data'], // fields to return with search results
  searchOptions: {
    prefix: true,
    fuzzy: 0.1, // more strict typos
    boost: { id: 2, numeroordre: 2, name: 1.5 }, // prioritize ID and Order Number matches
  },
});

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INDEX': {
      // Build index for households
      const documents = (payload.households || []).map((h: HouseholdDocument) => ({
        id: String(h.id),
        name: String(h.owner?.name || h.name || 'N/A'),
        numeroordre: String(h.numeroordre || ''),
        phone: String(h.phone || ''),
        data: h, // Store the full object for quick mapping if needed
      }));

      miniSearch.removeAll();
      miniSearch.addAll(documents);

      self.postMessage({ type: 'INDEX_READY' });
      break;
    }

    case 'SEARCH': {
      const isNumeric = /^\d+$/.test(payload.query);
      const results = miniSearch.search(payload.query, {
        prefix: !isNumeric, // Désactiver le préfixe pour les nombres (ex: 404 ne trouve plus 4047)
        fuzzy: isNumeric ? false : 0.1, // Désactiver le flou pour les nombres
        boost: { numeroordre: 5, id: 2, name: 1.5 }, // Gros boost sur le numéro d'ordre
      });
      // Limit to 10 best matches
      const topResults = results.slice(0, 10).map((r) => {
        const order = r.numeroordre ? ` [ORDRE: ${r.numeroordre}]` : '';
        return {
          type: 'household',
          id: r.id,
          label: `${r.name}${order}`,
          data: r.data,
        };
      });

      self.postMessage({ type: 'SEARCH_RESULTS', results: topResults, query: payload.query });
      break;
    }

    case 'TERMINATE': {
      miniSearch.removeAll();
      self.close();
      break;
    }
  }
};

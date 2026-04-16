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
  village?: string;
  phone?: string;
  [key: string]: unknown;
}

const miniSearch = new MiniSearch({
  fields: ['id', 'name', 'village', 'phone'], // fields to index for full-text search
  storeFields: ['id', 'name', 'village', 'phone', 'data'], // fields to return with search results
  searchOptions: {
    prefix: true,
    fuzzy: 0.2, // allow small typos
    boost: { id: 2, name: 1.5 }, // prioritize ID and Name matches
  },
});

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INDEX': {
      // Build index for households
      const documents = (payload.households || []).map((h: HouseholdDocument) => ({
        id: h.id,
        name: h.owner?.name || h.name || 'N/A',
        village: h.village || '',
        phone: h.phone || '',
        data: h, // Store the full object for quick mapping if needed
      }));

      miniSearch.removeAll();
      miniSearch.addAll(documents);

      self.postMessage({ type: 'INDEX_READY' });
      break;
    }

    case 'SEARCH': {
      const results = miniSearch.search(payload.query);
      // Limit to 10 best matches
      const topResults = results.slice(0, 10).map((r) => ({
        type: 'household',
        id: r.id,
        label: `${r.id} — ${r.name}`,
        data: r.data,
      }));

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

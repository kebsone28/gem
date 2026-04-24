 
import Supercluster from 'supercluster';

let index: Supercluster | null = null;

/**
 * Supercluster Worker (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Déportation du clustering intensif pour libérer le thread UI.
 * Supporte jusqu'à 500k points sans ralentir la navigation.
 */
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'LOAD_POINTS': {
      const { points, options } = payload;
      
      index = new Supercluster({
        radius: 70,
        maxZoom: 16,
        ...options
      });
      
      index.load(points);
      self.postMessage({ type: 'LOADED' });
      break;
    }

    case 'GET_CLUSTERS': {
      if (!index) return;
      
      const { bbox, zoom, requestId } = payload;
      try {
        const clusters = index.getClusters(bbox, zoom);
        self.postMessage({ 
          type: 'CLUSTERS_DATA', 
          payload: { clusters, zoom, requestId } 
        });
      } catch (err) {
        self.postMessage({
          type: 'WORKER_ERROR',
          payload: {
            requestId,
            message: err instanceof Error ? err.message : 'Cluster calculation error',
          },
        });
      }
      break;
    }

    case 'GET_CHILDREN': {
      if (!index) return;
      const { clusterId, requestId } = payload;
      const children = index.getChildren(clusterId);
      self.postMessage({ type: 'CHILDREN_DATA', payload: { children, requestId } });
      break;
    }

    case 'GET_EXPANSION_ZOOM': {
      if (!index) return;
      const { clusterId, requestId } = payload;
      const zoom = index.getClusterExpansionZoom(clusterId);
      self.postMessage({ type: 'EXPANSION_ZOOM_DATA', payload: { zoom, requestId } });
      break;
    }

    case 'GET_LEAVES': {
      if (!index) return;
      const { clusterId, limit, offset } = payload;
      const leaves = index.getLeaves(clusterId, limit || Infinity, offset || 0);
      self.postMessage({ type: 'LEAVES_DATA', payload: { requestId: payload.requestId, leaves } });
      break;
    }
  }
};

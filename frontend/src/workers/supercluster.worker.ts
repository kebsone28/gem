import Supercluster from 'supercluster';
import type { Feature, Point } from 'geojson';

type Message = {
  type: string;
  requestId?: string;
  options?: any;
  points?: Feature<Point, Record<string, unknown>>[];
  bbox?: [number, number, number, number];
  zoom?: number;
  clusterId?: number;
  limit?: number;
  offset?: number;
};

let index: Supercluster | null = null;

const STATUS_WEIGHTS: Record<string, number> = {
  'Non conforme': 5,
  Refusé: 5,
  'Non éligible': 4,
  Désistement: 4,
  'En attente': 2,
  'Non encore installée': 2,
  Eligible: 1,
  'Livraison effectuée': 1,
  'Murs terminés': 1,
  'Réseau terminé': 1,
  'Intérieur terminé': 1,
  'Contrôle conforme': 0,
  default: 1,
};

function getStatusWeight(status?: string) {
  if (!status) return STATUS_WEIGHTS.default;
  return STATUS_WEIGHTS[status] ?? STATUS_WEIGHTS.default;
}

function createSupercluster(options?: any) {
  return new Supercluster({
    radius: 60,
    maxZoom: 16,
    ...options,
    map: (props: any) => {
      const status = String(props?.status || '');
      return {
        severity_score: getStatusWeight(status),
        critical_count: status === 'Non conforme' || status === 'Refusé' ? 1 : 0,
        blocked_count: status === 'Non éligible' || status === 'Désistement' ? 1 : 0,
        pending_count: status === 'En attente' || status === 'Non encore installée' ? 1 : 0,
        compliant_count: status === 'Contrôle conforme' ? 1 : 0,
        progress_count: [
          'Eligible',
          'Livraison effectuée',
          'Murs terminés',
          'Réseau terminé',
          'Intérieur terminé',
        ].includes(status)
          ? 1
          : 0,
      };
    },
    reduce: (acc: any, props: any) => {
      acc.severity_score = (acc.severity_score || 0) + (props.severity_score || 0);
      acc.critical_count = (acc.critical_count || 0) + (props.critical_count || 0);
      acc.blocked_count = (acc.blocked_count || 0) + (props.blocked_count || 0);
      acc.pending_count = (acc.pending_count || 0) + (props.pending_count || 0);
      acc.compliant_count = (acc.compliant_count || 0) + (props.compliant_count || 0);
      acc.progress_count = (acc.progress_count || 0) + (props.progress_count || 0);
    },
  });
}

function post(type: string, payload: any = {}) {
  (self as any).postMessage({ type, ...payload });
}

(self as any).onmessage = (ev: MessageEvent<Message>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        index = createSupercluster(msg.options);
        post('ready');
        return;
      }
      case 'load': {
        if (!index) index = createSupercluster(msg.options);
        index.load(msg.points || []);
        post('loaded', { count: msg.points?.length || 0 });
        return;
      }
      case 'getClusters': {
        if (!index) {
          post('clusters', { clusters: [], requestId: msg.requestId });
          return;
        }
        const clusters = index.getClusters(msg.bbox!, msg.zoom!);
        post('clusters', { clusters, requestId: msg.requestId });
        return;
      }
      case 'getLeaves': {
        if (!index) {
          post('leaves', { leaves: [], requestId: msg.requestId });
          return;
        }
        const leaves = index.getLeaves(msg.clusterId!, msg.limit || Infinity, msg.offset || 0);
        post('leaves', { leaves, requestId: msg.requestId });
        return;
      }
      case 'getClusterExpansionZoom': {
        if (!index) {
          post('expansionZoom', { zoom: null, requestId: msg.requestId });
          return;
        }
        const zoom = index.getClusterExpansionZoom(msg.clusterId!);
        post('expansionZoom', { zoom, requestId: msg.requestId });
        return;
      }
      case 'getChildren': {
        if (!index) {
          post('children', { children: [], requestId: msg.requestId });
          return;
        }
        const children = index.getChildren(msg.clusterId!);
        post('children', { children, requestId: msg.requestId });
        return;
      }
    }
  } catch (err: any) {
    post('error', { message: err?.message || String(err), requestId: msg.requestId });
  }
};

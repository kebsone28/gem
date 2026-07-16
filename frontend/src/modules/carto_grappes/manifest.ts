import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'carto_grappes',
  name: 'Planning Global',
  icon: 'MapPin',
  component: lazyWithRetry(() => import('./views/CartoGrappes'), 'lazy:carto-grappes'),
  route: '/operations/carto-grappes',
  requiredPermission: PERMISSIONS.TERRAIN_READ,
  category: 'OPERATIONS',
  description: 'Cartographie et suivi des grappes de raccordement PROQUELEC',
  isPackage: true,
  packageCategory: 'advanced',
  global: false,
  runtime: {
    preload: false,
    offlineFirst: false,
    realtime: false,
    sync: false,
  },
};

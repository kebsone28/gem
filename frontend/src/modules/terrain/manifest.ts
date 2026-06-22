import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'terrain',
    name: 'Terrain',
    icon: 'Map',
    component: lazyWithRetry(() => import('./views/Terrain'), 'lazy:terrain'),
    route: '/operations/map',
    requiredPermission: PERMISSIONS.TERRAIN_READ,
    category: 'OPERATIONS',
    description: 'Cartographie et supervision temps réel des grappes',
    isPackage: true,
    packageCategory: 'core',
    global: false,
    runtime: {
      offlineFirst: true,
      realtime: true,
      preload: true
    },
    events: {
      emits: ['TERRAIN_DATA_UPDATED'],
      listens: ['MISSION_CREATED']
    },
    ai: {
      autoPilot: false,
      contextProvider: true
    }
  };

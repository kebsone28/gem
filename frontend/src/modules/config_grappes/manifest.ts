import { lazyWithRetry } from '@utils/lazy';
import type { ModuleManifest } from '@core/kernel/types';
import { PERMISSIONS } from '@core/security/permissions';

export const manifest: ModuleManifest = {
  key: 'config_grappes',
  name: 'Config Grappes',
  icon: 'Settings2',
  component: lazyWithRetry(() => import('./views/ConfigGrappes'), 'lazy:config-grappes'),
  route: '/operations/config-grappes',
  requiredPermission: PERMISSIONS.GRAPPE_CONFIG,
  category: 'OPERATIONS',
  description: 'Configuration des grappes, lots et affectations entrepreneurs',
  isPackage: true,
  packageCategory: 'advanced',
  global: false,
};

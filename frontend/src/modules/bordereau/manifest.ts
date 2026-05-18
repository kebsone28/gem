import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'bordereau',
    name: 'Bordereau',
    icon: 'Users',
    component: lazyWithRetry(() => import('./views/Bordereau'), 'lazy:bordereau'),
    route: '/bordereau',
    requiredPermission: PERMISSIONS.LOGISTIQUE_OM,
    category: 'PILOTAGE',
    description: 'Gérez la logistique des équipes et les affectations terrain',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

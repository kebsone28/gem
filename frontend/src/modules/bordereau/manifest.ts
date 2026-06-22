import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'bordereau',
    name: 'Bordereau',
    icon: 'Users',
    component: lazyWithRetry(() => import('./views/Bordereau'), 'lazy:bordereau'),
    route: '/operations/delivery',
    requiredPermission: PERMISSIONS.LOGISTIQUE_OM,
    category: 'OPERATIONS',
    description: 'Gérez la logistique des équipes et les affectations terrain',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

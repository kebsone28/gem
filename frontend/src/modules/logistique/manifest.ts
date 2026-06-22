import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'logistique',
    name: 'Logistique',
    icon: 'Truck',
    component: lazyWithRetry(() => import('./views/Logistique'), 'lazy:logistique'),
    route: '/resources/inventory',
    requiredPermission: PERMISSIONS.LOGISTIQUE_MANAGE,
    category: 'RESOURCES',
    description: 'Gestion du déploiement et des ressources matérielles',
    tags: ['QR'],
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

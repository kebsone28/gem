import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'atelier',
    name: 'Atelier',
    icon: 'LayoutGrid',
    component: lazyWithRetry(() => import('./views/Atelier'), 'lazy:atelier'),
    route: '/resources/workshop',
    requiredPermission: PERMISSIONS.LOGISTIQUE_ATELIER,
    category: 'RESOURCES',
    description: 'Saisie et journalisation de la préparation des kits',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

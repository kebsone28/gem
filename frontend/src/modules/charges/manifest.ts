import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'charges',
    name: 'Charge',
    icon: 'BarChart3',
    component: lazyWithRetry(() => import('./views/Charges'), 'lazy:charges'),
    route: '/charges',
    allowedRoles: [ROLES.ADMIN, ROLES.DIRECTEUR, ROLES.COMPTABLE],
    category: 'PILOTAGE',
    description: 'Renseignez les budgets prévus, coûts réels et écarts financiers',
    visible: (ctx) => ctx.canAccessCharges,
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

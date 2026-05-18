import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'simulation',
    name: 'Simulation',
    icon: 'Calculator',
    component: lazyWithRetry(() => import('./views/Simulation'), 'lazy:simulation'),
    route: '/simulation',
    requiredPermission: PERMISSIONS.IA_SIMULATION,
    category: 'PILOTAGE',
    description: 'Calculez vos budgets et simulez des scénarios financiers',
    tags: ['IA'],
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

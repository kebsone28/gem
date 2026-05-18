import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'formation',
    name: 'Formations',
    icon: 'GraduationCap',
    component: lazyWithRetry(() => import('./views/PlanningFormation'), 'lazy:planning-formation'),
    route: '/planning-formation',
    requiredPermission: PERMISSIONS.UI_MAP,
    category: 'OPÉRATIONS',
    description: 'Planification des formations par région et session',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

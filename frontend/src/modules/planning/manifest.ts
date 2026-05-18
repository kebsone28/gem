import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'planning',
    name: 'Planning',
    icon: 'Calendar',
    component: lazyWithRetry(() => import('./views/Planning'), 'lazy:planning'),
    route: '/planning',
    requiredPermission: PERMISSIONS.MISSIONS_PLANNING,
    category: 'OPÉRATIONS',
    description: 'Planification intelligente des travaux par équipe',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'communication',
    name: 'Communication',
    icon: 'MessagesSquare',
    component: lazyWithRetry(() => import('./views/Communication'), 'lazy:communication'),
    route: '/communication',
    category: 'OPÉRATIONS',
    description: 'Messagerie équipe en direct, salons communs et discussions privées',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'sharedoc',
    name: 'Documents Partagés',
    icon: 'Folder',
    component: lazyWithRetry(() => import('./views/Sharedoc'), 'lazy:sharedoc'),
    route: '/sharedoc',
    requiredPermission: [PERMISSIONS.DOCS_PV],
    category: 'PILOTAGE',
    description: 'Gérez les documents, dossiers et versions partagés',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

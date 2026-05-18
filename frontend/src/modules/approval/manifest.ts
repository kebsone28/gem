import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'approval',
    name: 'Approbation',
    icon: 'ShieldCheck',
    component: lazyWithRetry(() => import('./views/Approbation'), 'lazy:approbation'),
    route: '/admin/approval',
    requiredPermission: PERMISSIONS.MISSIONS_VALIDATE,
    category: 'OPÉRATIONS',
    description: 'Validez ou rejetez les interventions effectuées sur le terrain',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

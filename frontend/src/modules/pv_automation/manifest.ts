import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'pv_automation',
    name: 'Automatisation PV',
    icon: 'ShieldCheck',
    component: lazyWithRetry(() => import('./views/PVAutomation'), 'lazy:pv-automation'),
    route: '/admin/pv-automation',
    requiredPermission: PERMISSIONS.DOCS_PV,
    category: 'PILOTAGE',
    description: 'Générez et gérez les procès-verbaux automatiquement',
    isPackage: true,
    packageCategory: 'advanced',
    global: true,
  };

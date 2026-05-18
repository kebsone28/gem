import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'ged_os_collect',
    name: 'GED OS Collect',
    icon: 'Activity',
    component: lazyWithRetry(() => import('./views/GedOsCollect'), 'lazy:ged-os-collect'),
    route: '/admin/ged-os-collect',
    requiredPermission: PERMISSIONS.UI_MAP,
    category: 'SYSTÈME',
    description: 'GED OS Collect - Moteur de saisie terrain universel GED OS',
  };

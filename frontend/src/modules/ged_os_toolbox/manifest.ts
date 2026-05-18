import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'ged_os_toolbox',
    name: 'GED OS Toolbox',
    icon: 'ClipboardCheck',
    component: lazyWithRetry(() => import('./views/InternalKoboSubmissions'), 'lazy:internal-kobo-submissions'),
    route: '/admin/internal-kobo',
    requiredPermission: PERMISSIONS.TERRAIN_TERMINAL,
    category: 'SYSTÈME',
    description: 'GED OS Toolbox - Fiches terrain natives soumises directement au VPS',
    isPackage: true,
    packageCategory: 'admin',
    global: true,
  };

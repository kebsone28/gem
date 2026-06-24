import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'ged_os_toolbox',
    name: 'GED OS Toolbox',
    icon: 'ClipboardCheck',
    component: lazyWithRetry(() => import('./views/ToolboxSubmissions'), 'lazy:toolbox-submissions'),
    route: '/admin/toolbox',
    requiredPermission: PERMISSIONS.TERRAIN_TERMINAL,
    category: 'ADMIN',
    description: 'GED OS Toolbox - Fiches terrain natives soumises directement au VPS',
    isPackage: true,
    packageCategory: 'admin',
    global: true,
  };

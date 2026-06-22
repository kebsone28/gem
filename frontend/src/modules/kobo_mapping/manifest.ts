import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'kobo_mapping',
    name: 'Mapping Kobo',
    icon: 'RefreshCw',
    component: lazyWithRetry(() => import('./views/KoboMappingMaster'), 'lazy:kobo-mapping'),
    route: '/admin/kobo-mapping',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'ADMIN',
    description: 'Configuration avancée des correspondances de champs KoboToolbox',
  };

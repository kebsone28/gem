import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'modules',
    name: 'Centre de Contrôle',
    icon: 'ServerCog',
    component: lazyWithRetry(() => import('./views/AdminModules'), 'lazy:admin-modules'),
    route: '/admin/hub',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'ADMIN',
    description: 'Tableau de bord de configuration globale et modules système',
  };

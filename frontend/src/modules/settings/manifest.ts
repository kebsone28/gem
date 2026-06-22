import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'settings',
    name: 'Paramètres',
    icon: 'Settings',
    component: lazyWithRetry(() => import('./views/Settings'), 'lazy:settings'),
    route: '/admin/settings',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'ADMIN',
    description: 'Réglages globaux de l’application et préférences personnelles',
  };

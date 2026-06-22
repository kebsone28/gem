import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'security',
    name: 'Sécurité',
    icon: 'ShieldCheck',
    component: lazyWithRetry(() => import('./views/SecuritySettings'), 'lazy:security'),
    route: '/admin/security',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'ADMIN',
    description: "Journal d'audit et contrôles de sécurité avancés",
  };

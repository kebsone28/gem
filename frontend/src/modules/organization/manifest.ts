import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'organization',
    name: 'Organisation',
    icon: 'Building2',
    component: lazyWithRetry(() => import('./views/OrganizationSettings'), 'lazy:organization'),
    route: '/admin/organization',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'ADMIN',
    description: 'Configurez votre identité visuelle et les paramètres de structure',
  };

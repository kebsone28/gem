import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'project_creation',
    name: 'Création Projet',
    icon: 'LayoutGrid',
    component: lazyWithRetry(() => import('./views/AdminProjectCreation'), 'lazy:admin-project-creation'),
    route: '/projects/create',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'PROJECTS',
    description: 'Initialisation de nouveaux projets et templates',
  };

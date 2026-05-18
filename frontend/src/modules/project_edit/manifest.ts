import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'project_edit',
    name: 'Modification Projet',
    icon: 'Pencil',
    component: lazyWithRetry(() => import('./views/AdminProjectEdit'), 'lazy:admin-project-edit'),
    route: '/admin/project-edit/:id',
    requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
    category: 'SYSTÈME',
    description: 'Mise à jour des paramètres et de la configuration du projet',
  };

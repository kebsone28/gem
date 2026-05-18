import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'users',
    name: 'Utilisateurs',
    icon: 'Users',
    component: lazyWithRetry(() => import('./views/AdminUsers'), 'lazy:admin-users'),
    route: '/admin/users',
    requiredPermission: PERMISSIONS.SYSTEM_USERS,
    category: 'SYSTÈME',
    description: 'Gérez les comptes, les rôles et les accès de votre équipe',
  };

import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'admin_permissions',
  name: 'Permissions',
  icon: 'Shield',
  component: lazyWithRetry(() => import('./views/AdminPermissions'), 'lazy:admin-permissions'),
  route: '/admin/permissions',
  requiredPermission: PERMISSIONS.SYSTEM_USERS,
  category: 'ADMIN',
  description: 'Matrice des permissions par rôle',
};

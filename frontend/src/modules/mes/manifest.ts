import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'mes',
  name: 'GED OS MES',
  icon: 'Zap',
  component: lazyWithRetry(() => import('./views/MESDashboard'), 'lazy:mes-dashboard'),
  route: '/admin/mes',
  requiredPermission: PERMISSIONS.UI_MAP,
  category: 'SECTORS',
  description: 'GED OS MES - Système de gestion des mises en service électriques (branchement, pose compteur, contrôle qualité)',
  isPackage: true,
  packageCategory: 'advanced',
  global: true,
};

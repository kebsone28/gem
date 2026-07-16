import { lazyWithRetry } from '@utils/lazy';
import type { ModuleManifest } from '@core/kernel/types';
import { PERMISSIONS } from '@core/security/permissions';

export const manifest: ModuleManifest = {
  key: 'dossiers_prestataires',
  name: 'Dossiers Prestataires',
  icon: 'FolderOpen',
  component: lazyWithRetry(() => import('./views/DossiersPrestataires'), 'lazy:dossiers-prestataires'),
  route: '/operations/dossiers',
  requiredPermission: PERMISSIONS.DOSSIERS_READ,
  category: 'OPERATIONS',
  description: 'Suivi des dossiers contractuels par prestataire et grappe',
  isPackage: true,
  packageCategory: 'advanced',
  global: false,
};

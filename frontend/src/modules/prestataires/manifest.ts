import { lazyWithRetry } from '@utils/lazy';
import type { ModuleManifest } from '@core/kernel/types';
import { PERMISSIONS } from '@core/security/permissions';

export const manifest: ModuleManifest = {
  key: 'prestataires',
  name: 'Prestataires',
  icon: 'Building2',
  component: lazyWithRetry(() => import('./views/Prestataires'), 'lazy:prestataires'),
  route: '/operations/prestataires',
  requiredPermission: PERMISSIONS.PRESTATAIRES_READ,
  category: 'OPERATIONS',
  description: 'Gestion des prestataires et entreprises partenaires',
  isPackage: true,
  packageCategory: 'advanced',
  global: false,
};

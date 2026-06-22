import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'ged_os_collect',
  name: 'GED OS Collect',
  icon: 'Activity',
  // Explicit .tsx extension to ensure Vite resolves the module correctly
  component: lazyWithRetry(() => import('./views/GedOsCollect.tsx'), 'lazy:ged-os-collect'),
  route: '/operations/collect',
  requiredPermission: PERMISSIONS.UI_MAP,
  category: 'OPERATIONS',
  description: 'GED OS Collect - Moteur de saisie terrain universel GED OS',
};

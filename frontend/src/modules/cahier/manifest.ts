import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'cahier',
    name: 'Cahier de Charge',
    icon: 'FileText',
    component: lazyWithRetry(() => import('./views/Cahier'), 'lazy:cahier'),
    route: '/documents/specifications',
    requiredPermission: [PERMISSIONS.TERRAIN_READ, PERMISSIONS.FINANCE_READ],
    category: 'DOCUMENTS',
    description: 'Consultez les spécifications techniques et les rapports détaillés',
  };

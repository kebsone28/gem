import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'diagnostic',
    name: 'Diagnostic Santé',
    icon: 'Activity',
    component: lazyWithRetry(() => import('./views/DiagnosticSante'), 'lazy:diagnostic'),
    route: '/admin/diagnostic',
    requiredPermission: PERMISSIONS.SYSTEM_AUDIT,
    category: 'ADMIN',
    description: 'Vérifiez l’état technique du serveur et de la synchronisation',
  };

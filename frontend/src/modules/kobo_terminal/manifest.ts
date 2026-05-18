import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'kobo_terminal',
    name: 'Terminal KoboToolbox',
    icon: 'Terminal',
    component: lazyWithRetry(() => import('./views/KoboTerminal'), 'lazy:kobo-terminal'),
    route: '/admin/kobo-terminal',
    requiredPermission: PERMISSIONS.TERRAIN_TERMINAL,
    category: 'SYSTÈME',
    description: 'API officielle KoboCollect pour la synchronisation',
    isPackage: true,
    packageCategory: 'admin',
    global: true,
  };

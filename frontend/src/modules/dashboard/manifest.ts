import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'dashboard',
    name: 'Tableau de Bord',
    icon: 'LayoutDashboard',
    component: lazyWithRetry(() => import('./views/Dashboard'), 'lazy:dashboard'),
    route: '/executive/dashboard',
    requiredPermission: PERMISSIONS.UI_PROJECTS,
    required: true,
    category: 'EXECUTIVE',
    description: "Vue d'ensemble de la mission et indicateurs clés",
    tags: ['IA'],
    isPackage: true,
    packageCategory: 'core',
    global: false,
  };

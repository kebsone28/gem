import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'home',
    name: 'Accueil',
    icon: 'Home',
    component: lazyWithRetry(() => import('./views/Home'), 'lazy:home'),
    route: '/projects',
    category: 'PROJECTS',
    description: 'Retour à la sélection des projets',
  };

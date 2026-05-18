import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'login',
    name: 'Connexion',
    icon: 'LogIn',
    component: lazyWithRetry(() => import('./views/Login'), 'lazy:login'),
    route: '/login',
    category: 'UTILITAIRE',
    description: 'Accès sécurisé à la plateforme',
    noLayout: true,
  };

import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'help',
    name: "Centre d'Aide",
    icon: 'HelpCircle',
    component: lazyWithRetry(() => import('./views/Aide'), 'lazy:aide'),
    route: '/aide',
    category: 'ADMIN',
    description: "Besoin d'un guide ? Consultez notre documentation complète",
  };

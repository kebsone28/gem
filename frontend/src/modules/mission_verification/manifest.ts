import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'mission_verification',
    name: 'Vérification Mission',
    icon: 'Search',
    component: lazyWithRetry(() => import('./views/MissionVerification'), 'lazy:mission-verification'),
    route: '/verify/mission/:identifier',
    category: 'UTILITAIRE',
    description: 'Vérification publique des ordres de mission',
    noLayout: true,
  };

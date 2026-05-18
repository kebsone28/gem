import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'mission',
    name: 'Missions',
    icon: 'ClipboardList',
    component: lazyWithRetry(() => import('./views/MissionOrder'), 'lazy:mission-order'),
    route: '/admin/mission',
    requiredPermission: PERMISSIONS.MISSIONS_CREATE,
    category: 'OPÉRATIONS',
    description: 'Planifiez vos prochaines missions et objectifs',
    visible: (ctx) => (ctx.nRole === 'DIRECTEUR' ? ctx.visibleMissionPanels.length > 0 : true),
    isPackage: true,
    packageCategory: 'core',
    global: false,
  };

import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS, ROLES } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'communication',
  name: 'Chat',
  icon: 'MessagesSquare',
  component: lazyWithRetry(() => import('./views/Communication'), 'lazy:communication'),
  route: '/communication',
  category: 'OPERATIONS',
  description: "Chat d'équipe, salons et discussions privées",
  isPackage: true,
  packageCategory: 'advanced',
  global: true,
};

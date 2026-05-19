import { lazyWithRetry } from '../../utils/lazy';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'health',
  name: 'Santé',
  icon: 'HeartPulse',
  component: lazyWithRetry(() => import('./views/HealthDashboard'), 'lazy:health'),
  route: '/health',
  category: 'OPÉRATIONS',
  description: 'Suivi des structures de santé, campagnes vaccinales et couverture sanitaire',
  isPackage: true,
  packageCategory: 'advanced',
  global: true,
  visible: () => true,
};

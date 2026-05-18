import { lazyWithRetry } from '../../utils/lazy';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'agriculture',
  name: 'Agriculture Pilot',
  icon: 'Sprout',
  component: lazyWithRetry(() => import('./views/Fields'), 'lazy:agriculture'),
  route: '/fields',
  category: 'OPÉRATIONS', // Utilise "OPÉRATIONS" avec accent exact pour correspondre aux catégories du sidebar!
  description: 'Suivi agronomique intelligent et gestion des parcelles',
  isPackage: true,
  packageCategory: 'advanced',
  global: true,
  visible: () => true
};

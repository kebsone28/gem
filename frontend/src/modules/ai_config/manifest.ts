import { lazyWithRetry } from '../../utils/lazy';
import { PERMISSIONS, ROLES } from '../../core/security/permissions';
import type { ModuleManifest } from '../../core/kernel/types';

export const manifest: ModuleManifest = {
    key: 'ai_config',
    name: 'Configuration IA',
    icon: 'Brain',
    component: lazyWithRetry(() => import('./views/AdminAIConfig'), 'lazy:admin-ai-config'),
    route: '/admin/ai-config',
    requiredPermission: PERMISSIONS.IA_CONFIG,
    category: 'SYSTÈME',
    description: 'Configuration du cerveau IA, modes et auto-entraînement souverain',
    isPackage: true,
    packageCategory: 'admin',
    global: false,
  };

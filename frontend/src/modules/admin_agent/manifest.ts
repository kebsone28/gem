import { lazyWithRetry } from '@utils/lazy';
import { PERMISSIONS } from '@core/security/permissions';
import type { ModuleManifest } from '@core/kernel/types';

export const manifest: ModuleManifest = {
  key: 'admin_agent',
  name: 'Agent Local',
  icon: 'ServerCog',
  component: lazyWithRetry(() => import('./views/AdminAgentLocal'), 'lazy:admin-agent-local'),
  route: '/admin/agent-local',
  requiredPermission: PERMISSIONS.SYSTEM_CONFIG,
  category: 'ADMIN',
  description: "Guide administrateur de l'agent local OpenHands, du tunnel Ollama et de Claude Code",
  isPackage: true,
  packageCategory: 'admin',
  global: false,
};

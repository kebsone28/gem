import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../../../core/config/permissions.js';

vi.mock('../../middlewares/auth.js', () => ({
  authProtect: (req, _res, next) => {
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'CHEF_EQUIPE',
      permissions: [],
    };
    next();
  },
}));

vi.mock('../../../middleware/verifierPermission.js', () => ({
  verifierPermission: (requiredPermission) => (req, res, next) => {
    const provided = String(req.headers['x-test-permissions'] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!provided.includes(requiredPermission)) {
      return res.status(403).json({ error: 'forbidden', requiredPermission });
    }
    req.requiredPermission = requiredPermission;
    return next();
  },
}));

vi.mock('../../../modules/monitoring/monitoring.controller.js', () => ({
  getActivityFeed: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
  getPerformanceStats: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
  getSystemHealth: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
}));

vi.mock('../../../modules/sync/sync.controller.js', () => ({
  pullChanges: (_req, res) => res.json({ ok: true }),
  pushChanges: (_req, res) => res.json({ ok: true }),
  syncKobo: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
  clearEntityData: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission, entity: req.params.entity }),
  bulkImportHouseholds: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
}));

vi.mock('../../../modules/organization/organization.controller.js', () => ({
  getConfig: (_req, res) => res.json({ ok: true }),
  updateConfig: (req, res) => res.json({ ok: true, requiredPermission: req.requiredPermission }),
}));

const { default: monitoringRoutes } = await import('../monitoring.routes.js');
const { default: syncRoutes } = await import('../sync.routes.js');
const { default: organizationRoutes } = await import('../organization.routes.js');

const buildApp = (path, router) => {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
};

describe('Route permission hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('protects monitoring endpoints with VOIR_DIAGNOSTIC', async () => {
    const app = buildApp('/api/monitoring', monitoringRoutes);

    const denied = await request(app).get('/api/monitoring/activity');
    expect(denied.status).toBe(403);
    expect(denied.body.requiredPermission).toBe(PERMISSIONS.VOIR_DIAGNOSTIC);

    const allowed = await request(app)
      .get('/api/monitoring/activity')
      .set('x-test-permissions', PERMISSIONS.VOIR_DIAGNOSTIC);
    expect(allowed.status).toBe(200);
    expect(allowed.body.requiredPermission).toBe(PERMISSIONS.VOIR_DIAGNOSTIC);
  });

  it('protects sync sensitive endpoints with expected permissions', async () => {
    const app = buildApp('/api/sync', syncRoutes);

    const deniedKobo = await request(app).post('/api/sync/kobo').send({});
    expect(deniedKobo.status).toBe(403);
    expect(deniedKobo.body.requiredPermission).toBe(PERMISSIONS.ACCES_TERMINAL_KOBO);

    const allowedKobo = await request(app)
      .post('/api/sync/kobo')
      .set('x-test-permissions', PERMISSIONS.ACCES_TERMINAL_KOBO)
      .send({});
    expect(allowedKobo.status).toBe(200);

    const deniedClear = await request(app).delete('/api/sync/clear/households').send({});
    expect(deniedClear.status).toBe(403);
    expect(deniedClear.body.requiredPermission).toBe(PERMISSIONS.GERER_PARAMETRES);

    const allowedClear = await request(app)
      .delete('/api/sync/clear/households')
      .set('x-test-permissions', PERMISSIONS.GERER_PARAMETRES)
      .send({});
    expect(allowedClear.status).toBe(200);
    expect(allowedClear.body.requiredPermission).toBe(PERMISSIONS.GERER_PARAMETRES);
  });

  it('protects organization config update with GERER_PARAMETRES', async () => {
    const app = buildApp('/api/organization', organizationRoutes);

    const denied = await request(app).patch('/api/organization/config').send({ config: {} });
    expect(denied.status).toBe(403);
    expect(denied.body.requiredPermission).toBe(PERMISSIONS.GERER_PARAMETRES);

    const allowed = await request(app)
      .patch('/api/organization/config')
      .set('x-test-permissions', PERMISSIONS.GERER_PARAMETRES)
      .send({ config: { featureFlags: { demo: false } } });
    expect(allowed.status).toBe(200);
    expect(allowed.body.requiredPermission).toBe(PERMISSIONS.GERER_PARAMETRES);
  });
});


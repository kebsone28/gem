import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middlewares/auth.js', () => ({
  authProtect: (req, _res, next) => {
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'ADMIN_PROQUELEC',
      permissions: ['gerer_parametres'],
    };
    next();
  },
}));

vi.mock('../../../middleware/verifierPermission.js', () => ({
  verifierPermission: () => (_req, _res, next) => next(),
}));

const { default: syncRoutes } = await import('../sync.routes.js');
const { default: organizationRoutes } = await import('../organization.routes.js');

const buildApp = (path, router) => {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
};

describe('Input validation hardening', () => {
  it('rejects sync push when changes is not an object', async () => {
    const app = buildApp('/api/sync', syncRoutes);

    const res = await request(app).post('/api/sync/push').send({ changes: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload: "changes" must be an object');
  });

  it('rejects sync push when schema is invalid', async () => {
    const app = buildApp('/api/sync', syncRoutes);

    const res = await request(app)
      .post('/api/sync/push')
      .send({ changes: { households: [{ id: 'h1' }] } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid sync payload');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('rejects organization config patch when config is not an object', async () => {
    const app = buildApp('/api/organization', organizationRoutes);

    const res = await request(app)
      .patch('/api/organization/config')
      .send({ config: ['invalid'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Le champ "config" doit être un objet JSON valide.');
  });
});


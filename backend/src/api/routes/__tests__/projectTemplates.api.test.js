import { beforeEach, describe, expect, it, vi } from 'vitest';

// Tests use per-test timeouts instead of global vi.setTimeout
import request from 'supertest';
import prisma from '../../../core/utils/prisma.js';

vi.mock('../../../core/utils/prisma.js', () => ({
  default: {
    projectTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../../api/middlewares/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authProtect: (req, _res, next) => {
      req.user = {
        id: 'user-1',
        organizationId: 'org-1',
        email: 'test@local',
        role: 'ADMIN_PROQUELEC',
        permissions: [],
      };
      next();
    },
    authorize: (..._args) => (req, res, next) => next(),
  };
});

vi.mock('../../../middleware/verifierPermission.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifierPermission: () => (req, res, next) => next(),
    verifierProjet: () => (req, res, next) => next(),
  };
});

vi.mock('../../../services/audit.service.js', () => ({
  tracerAction: vi.fn(),
}));

const { default: app } = await import('../../../app.js');
const { tracerAction } = await import('../../../services/audit.service.js');

describe('Project Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists templates', async () => {
    vi.mocked(prisma.projectTemplate.findMany).mockResolvedValue([
      { id: 'tpl-1', name: 'Tpl 1' },
      { id: 'tpl-2', name: 'Tpl 2' },
    ]);

    const res = await request(app).get('/api/project-templates');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(prisma.projectTemplate.findMany).toHaveBeenCalled();
  }, 20000);

  it('creates a template and records audit', async () => {
    const created = { id: 'tpl-new', name: 'New template', key: 'new' };
    vi.mocked(prisma.projectTemplate.create).mockResolvedValue(created);

    const payload = { key: 'new', name: 'New template', description: 'desc' };
    const res = await request(app).post('/api/project-templates').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(created.id);
    expect(prisma.projectTemplate.create).toHaveBeenCalled();
    expect(tracerAction).toHaveBeenCalled();
  }, 20000);
});

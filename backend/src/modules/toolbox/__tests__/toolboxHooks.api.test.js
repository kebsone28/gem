import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import prisma from '../../../core/utils/prisma.js';

vi.mock('../../../core/utils/prisma.js', () => ({
  default: {
    toolboxFormHook: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
        email: 'admin@test.com',
        role: 'ADMIN_PROQUELEC',
        permissions: [],
      };
      next();
    },
  };
});

const { default: app } = await import('../../../app.js');

const mockHook = {
  id: 'hook-1',
  organizationId: 'org-1',
  formKey: 'test_form',
  name: 'Test Hook',
  url: 'https://example.com/webhook',
  method: 'POST',
  headers: {},
  active: true,
  lastTriggeredAt: null,
  lastStatus: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Toolbox Hooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists hooks for the organization', async () => {
    vi.mocked(prisma.toolboxFormHook.findMany).mockResolvedValue([mockHook]);

    const res = await request(app).get('/api/toolbox/hooks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hooks).toHaveLength(1);
    expect(res.body.hooks[0].id).toBe('hook-1');
    expect(prisma.toolboxFormHook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) }),
    );
  });

  it('filters hooks by formKey', async () => {
    vi.mocked(prisma.toolboxFormHook.findMany).mockResolvedValue([mockHook]);

    const res = await request(app).get('/api/toolbox/hooks?formKey=test_form');

    expect(res.status).toBe(200);
    expect(prisma.toolboxFormHook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ formKey: 'test_form', organizationId: 'org-1' }),
      }),
    );
  });

  it('creates a new hook', async () => {
    vi.mocked(prisma.toolboxFormHook.create).mockResolvedValue(mockHook);

    const payload = {
      formKey: 'test_form',
      name: 'Test Hook',
      url: 'https://example.com/webhook',
    };

    const res = await request(app).post('/api/toolbox/hooks').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.hook.id).toBe('hook-1');
    expect(prisma.toolboxFormHook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          formKey: 'test_form',
          name: 'Test Hook',
          url: 'https://example.com/webhook',
          method: 'POST',
        }),
      }),
    );
  });

  it('rejects creation without required fields', async () => {
    const res = await request(app).post('/api/toolbox/hooks').send({ name: 'Incomplete' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('formKey');
  });

  it('handles duplicate hook conflict', async () => {
    vi.mocked(prisma.toolboxFormHook.create).mockRejectedValue({ code: 'P2002' });

    const res = await request(app).post('/api/toolbox/hooks').send({
      formKey: 'test_form',
      name: 'Duplicate',
      url: 'https://example.com/dup',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('existe déjà');
  });

  it('updates an existing hook', async () => {
    vi.mocked(prisma.toolboxFormHook.findFirst).mockResolvedValue(mockHook);
    vi.mocked(prisma.toolboxFormHook.update).mockResolvedValue({
      ...mockHook,
      name: 'Updated Hook',
      active: false,
    });

    const res = await request(app).patch('/api/toolbox/hooks/hook-1').send({
      name: 'Updated Hook',
      active: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hook.name).toBe('Updated Hook');
    expect(res.body.hook.active).toBe(false);
  });

  it('returns 404 on updating unknown hook', async () => {
    vi.mocked(prisma.toolboxFormHook.findFirst).mockResolvedValue(null);

    const res = await request(app).patch('/api/toolbox/hooks/unknown').send({ name: 'Nope' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Hook introuvable');
  });

  it('deletes a hook', async () => {
    vi.mocked(prisma.toolboxFormHook.findFirst).mockResolvedValue(mockHook);

    const res = await request(app).delete('/api/toolbox/hooks/hook-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.toolboxFormHook.delete).toHaveBeenCalledWith({ where: { id: 'hook-1' } });
  });

  it('returns 404 on deleting unknown hook', async () => {
    vi.mocked(prisma.toolboxFormHook.findFirst).mockResolvedValue(null);

    const res = await request(app).delete('/api/toolbox/hooks/unknown');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Hook introuvable');
  });

  it('tests a hook via POST /hooks/:id/test', async () => {
    vi.mocked(prisma.toolboxFormHook.findFirst).mockResolvedValue(mockHook);
    vi.mocked(prisma.toolboxFormHook.update).mockResolvedValue(mockHook);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
    });

    const res = await request(app).post('/api/toolbox/hooks/hook-1/test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe(200);
  });
});

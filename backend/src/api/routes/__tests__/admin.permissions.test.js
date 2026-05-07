import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import prisma from '../../../core/utils/prisma.js';

vi.mock('../../../core/utils/prisma.js', () => ({
  default: {
    role: { findFirst: vi.fn() },
    rolePermission: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    permission: { findMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
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

vi.mock('../../../middleware/verifierPermission.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifierPermission: () => (req, res, next) => next(),
  };
});

vi.mock('../../../services/audit.service.js', () => ({
  tracerAction: vi.fn(),
}));

const { default: app } = await import('../../../app.js');
const { tracerAction } = await import('../../../services/audit.service.js');

describe('Admin Permissions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates role permissions and records an audit log', async () => {
    // Arrange: mock role exists
    vi.mocked(prisma.role.findFirst).mockResolvedValue({ id: 'role-1', name: 'CHEF_EQUIPE' });

    // before rolePermission entries
    vi.mocked(prisma.rolePermission.findMany).mockResolvedValue([{ id: 'rp-1', permission: { key: 'PERM_A' } }]);

    // permission.findMany returns only one existing, so missing will trigger createMany
    vi.mocked(prisma.permission.findMany)
      .mockResolvedValueOnce([{ id: 'perm-1', key: 'PERM_A' }])
      .mockResolvedValueOnce([{ id: 'perm-1', key: 'PERM_A' }, { id: 'perm-2', key: 'PERM_B' }]);

    // $transaction should resolve
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      // If given a function, call it with a tx-like object that has rolePermission and permission
      if (typeof fn === 'function') {
        const tx = {
          rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
          permission: { findMany: vi.fn() },
        };
        return fn(tx);
      }
      return Promise.resolve();
    });

    const payload = { permissions: ['PERM_A', 'PERM_B'] };

    // Act
    const res = await request(app).post('/api/admin/role-permissions/CHEF_EQUIPE').send(payload);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prisma.role.findFirst).toHaveBeenCalled();
    expect(prisma.rolePermission.findMany).toHaveBeenCalled();
    expect(prisma.permission.findMany).toHaveBeenCalled();
    expect(prisma.permission.createMany).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tracerAction).toHaveBeenCalled();
    // details.after should match payload.permissions
    const called = vi.mocked(tracerAction).mock.calls[0][0];
    expect(called.details.after).toEqual(payload.permissions);
  });
});

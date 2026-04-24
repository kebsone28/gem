import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import prisma from '../../../core/utils/prisma.js';

vi.mock('../../../core/utils/prisma.js', () => ({
  default: {
    alert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    alertConfiguration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../../../api/middlewares/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authProtect: (req, _res, next) => {
      req.user = {
        id: 'user-1',
        organizationId: 'test-org-123',
        email: 'admin@test.com',
        role: 'ADMIN_PROQUELEC',
        permissions: [],
      };
      next();
    },
  };
});

const { default: app } = await import('../../../app.js');

describe('Alerts API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns alerts for a project', async () => {
    vi.mocked(prisma.alert.findMany).mockResolvedValue([
      {
        id: 'alert-1',
        organizationId: 'test-org-123',
        projectId: 'proj-123',
        type: 'IGPP_STOCK',
        severity: 'HIGH',
        status: 'OPEN',
        createdAt: new Date(),
      },
    ]);

    const response = await request(app).get('/api/alerts/proj-123');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(prisma.alert.findMany).toHaveBeenCalled();
  });

  it('validates required fields on alert creation', async () => {
    const response = await request(app).post('/api/alerts').send({
      type: 'IGPP_STOCK',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('creates a new alert', async () => {
    vi.mocked(prisma.alert.create).mockResolvedValue({
      id: 'alert-2',
      organizationId: 'test-org-123',
      projectId: 'proj-123',
      type: 'IGPP_STOCK',
      severity: 'LOW',
      title: 'Stock faible',
      status: 'OPEN',
    });

    const response = await request(app).post('/api/alerts').send({
      projectId: 'proj-123',
      type: 'IGPP_STOCK',
      severity: 'LOW',
      title: 'Stock faible',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(prisma.alert.create).toHaveBeenCalled();
  });

  it('acknowledges an alert', async () => {
    vi.mocked(prisma.alert.findUnique).mockResolvedValue({
      id: 'alert-3',
      organizationId: 'test-org-123',
      status: 'OPEN',
      metadata: {},
    });
    vi.mocked(prisma.alert.update).mockResolvedValue({
      id: 'alert-3',
      organizationId: 'test-org-123',
      status: 'ACKNOWLEDGED',
    });

    const response = await request(app).patch('/api/alerts/alert-3/acknowledge').send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(prisma.alert.update).toHaveBeenCalled();
  });

  it('resolves an alert', async () => {
    vi.mocked(prisma.alert.findUnique).mockResolvedValue({
      id: 'alert-4',
      organizationId: 'test-org-123',
      status: 'ACKNOWLEDGED',
      metadata: {},
    });
    vi.mocked(prisma.alert.update).mockResolvedValue({
      id: 'alert-4',
      organizationId: 'test-org-123',
      status: 'RESOLVED',
    });

    const response = await request(app)
      .patch('/api/alerts/alert-4/resolve')
      .send({ comment: 'fixed' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(prisma.alert.update).toHaveBeenCalled();
  });

  it('returns alert statistics for a project', async () => {
    vi.mocked(prisma.alert.groupBy)
      .mockResolvedValueOnce([{ status: 'OPEN', severity: 'HIGH', type: 'IGPP_STOCK', _count: 2 }])
      .mockResolvedValueOnce([{ status: 'OPEN', _count: 2 }]);
    vi.mocked(prisma.alert.count).mockResolvedValue(1);

    const response = await request(app).get('/api/alerts/proj-123/stats');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalCritical).toBe(1);
  });

  it('returns alert configuration for the organization', async () => {
    vi.mocked(prisma.alertConfiguration.findUnique).mockResolvedValue({
      organizationId: 'test-org-123',
      stockCritical: 10,
    });

    const response = await request(app).get('/api/alerts/config/organization');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.stockCritical).toBe(10);
  });
});
